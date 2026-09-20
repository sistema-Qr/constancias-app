require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.development.local') });

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { query } = require('../db/pool');

const { ponerCookieSesion, borrarCookieSesion, requireLogin, requireAdmin } = require('../lib/auth');
const { generarConstanciaPDF } = require('../lib/pdfConstancia');
const { fusionarPDFs } = require('../lib/mergePdf');

const app = express();
const ROOT = path.join(__dirname, '..');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Express 4 NO captura automáticamente errores lanzados dentro de handlers async:
// si no se atrapan, la petición se queda colgada hasta que la plataforma la mata
// (eso es lo que causaba los 504 en Vercel). Este wrapper evita ese problema.
function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(ROOT, 'public')));

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.headers.host}`;
}

async function generarFolio() {
  const anio = new Date().getFullYear();
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM constancias WHERE folio LIKE $1`,
    [`CUEJ-${anio}-%`]
  );
  const consecutivo = String(rows[0].n + 1).padStart(4, '0');
  return `CUEJ-${anio}-${consecutivo}`;
}

function extraerCamposFormulario(b) {
  return {
    tipo: b.tipo || 'termino',
    matricula: b.matricula || null,
    nombre: b.nombre,
    apellido_paterno: b.apellido_paterno,
    apellido_materno: b.apellido_materno || '',
    programa: b.programa || null,
    plan_estudios: b.plan_estudios || '',
    promedio: b.promedio || '',
    creditos_totales: b.creditos_totales || '',
    creditos_obtenidos: b.creditos_obtenidos || '',
    ciclo_inicio: b.ciclo_inicio || '',
    ciclo_fin: b.ciclo_fin || '',
    destinatario_nombre: b.destinatario_nombre || '',
    destinatario_cargo: b.destinatario_cargo || '',
    texto_adicional: b.texto_adicional || '',
    lugar_emision: b.lugar_emision || 'Ciudad de México',
    titulo_docente: b.titulo_docente || '',
    cargo_docente: b.cargo_docente || '',
    materias_titular: b.materias_titular || '',
    materias_impartidas: b.materias_impartidas || '',
    fecha_desde: b.fecha_desde || '',
    texto_destacado: b.texto_destacado || '',
    logros_adicionales: b.logros_adicionales || ''
  };
}

function validarFormulario(b) {
  if (!b.nombre || !b.apellido_paterno) {
    return 'Nombre y apellido paterno son obligatorios.';
  }
  if ((b.tipo === 'termino' || b.tipo === 'avance') && (!b.matricula || !b.programa)) {
    return 'Matrícula y programa son obligatorios para constancias de término o avance.';
  }
  return null;
}

// ================== AUTENTICACIÓN ==================

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', ah(async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await query(
    'SELECT * FROM empleados WHERE username = $1 AND activo = TRUE',
    [username]
  );
  const empleado = rows[0];

  if (!empleado || !bcrypt.compareSync(password, empleado.password_hash)) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
  }

  ponerCookieSesion(res, empleado);
  res.redirect('/dashboard');
}));

app.post('/logout', (req, res) => {
  borrarCookieSesion(res);
  res.redirect('/login');
});

// ================== PANEL DE EMPLEADOS (protegido) ==================

app.get('/dashboard', requireLogin, ah(async (req, res) => {
  const q = (req.query.q || '').trim();
  let constancias;

  if (q) {
    const like = `%${q}%`;
    const { rows } = await query(
      `SELECT c.*, e.nombre_completo AS emitido_por_nombre
       FROM constancias c
       JOIN empleados e ON e.id = c.emitido_por
       WHERE c.nombre ILIKE $1
          OR c.apellido_paterno ILIKE $1
          OR c.apellido_materno ILIKE $1
          OR c.matricula ILIKE $1
          OR c.folio ILIKE $1
          OR c.programa ILIKE $1
       ORDER BY c.id DESC
       LIMIT 100`,
      [like]
    );
    constancias = rows;
  } else {
    const { rows } = await query(`
      SELECT c.*, e.nombre_completo AS emitido_por_nombre
      FROM constancias c
      JOIN empleados e ON e.id = c.emitido_por
      ORDER BY c.id DESC
      LIMIT 100
    `);
    constancias = rows;
  }

  res.render('dashboard', { empleado: req.empleado, constancias, q, activo: 'dashboard' });
}));

app.get('/constancias/nueva', requireLogin, (req, res) => {
  const tipoInicial = ['termino', 'avance', 'docente'].includes(req.query.tipo) ? req.query.tipo : 'termino';
  res.render('nueva', {
    empleado: req.empleado,
    error: null,
    editando: false,
    token: null,
    valores: { tipo: tipoInicial },
    activo: 'nueva'
  });
});

app.post('/constancias/nueva', requireLogin, upload.single('historial'), ah(async (req, res) => {
  const b = req.body;
  const errorValidacion = validarFormulario(b);

  if (errorValidacion) {
    return res.render('nueva', {
      empleado: req.empleado,
      error: errorValidacion,
      editando: false,
      token: null,
      valores: b,
      activo: 'nueva'
    });
  }

  const campos = extraerCamposFormulario(b);
  const folio = await generarFolio();
  const token = uuidv4();
  const fechaEmision = b.fecha_emision || new Date().toISOString().slice(0, 10);
  const historialBuffer = req.file ? req.file.buffer : null;
  const historialNombre = req.file ? req.file.originalname : null;

  await query(
    `INSERT INTO constancias (
      folio, token, tipo, matricula, nombre, apellido_paterno, apellido_materno,
      programa, plan_estudios, promedio, creditos_totales, creditos_obtenidos,
      ciclo_inicio, ciclo_fin, destinatario_nombre, destinatario_cargo,
      texto_adicional, lugar_emision, fecha_emision, emitido_por,
      titulo_docente, cargo_docente, materias_titular, materias_impartidas,
      fecha_desde, texto_destacado, logros_adicionales, historial_pdf, historial_pdf_nombre
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
    [
      folio, token, campos.tipo, campos.matricula, campos.nombre, campos.apellido_paterno, campos.apellido_materno,
      campos.programa, campos.plan_estudios, campos.promedio, campos.creditos_totales, campos.creditos_obtenidos,
      campos.ciclo_inicio, campos.ciclo_fin, campos.destinatario_nombre, campos.destinatario_cargo,
      campos.texto_adicional, campos.lugar_emision, fechaEmision, req.empleado.id,
      campos.titulo_docente, campos.cargo_docente, campos.materias_titular, campos.materias_impartidas,
      campos.fecha_desde, campos.texto_destacado, campos.logros_adicionales, historialBuffer, historialNombre
    ]
  );

  res.redirect('/dashboard');
}));

app.get('/constancias/:token/editar', requireLogin, ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM constancias WHERE token = $1', [req.params.token]);
  const c = rows[0];
  if (!c) return res.status(404).send('Constancia no encontrada.');

  const fechaEmisionInput = c.fecha_emision instanceof Date
    ? c.fecha_emision.toISOString().slice(0, 10)
    : c.fecha_emision;

  res.render('nueva', {
    empleado: req.empleado,
    error: null,
    editando: true,
    token: c.token,
    valores: { ...c, fecha_emision_input: fechaEmisionInput },
    activo: 'dashboard'
  });
}));

app.post('/constancias/:token/editar', requireLogin, upload.single('historial'), ah(async (req, res) => {
  const b = req.body;
  const { rows } = await query('SELECT * FROM constancias WHERE token = $1', [req.params.token]);
  const existente = rows[0];
  if (!existente) return res.status(404).send('Constancia no encontrada.');

  b.tipo = existente.tipo;
  const errorValidacion = validarFormulario(b);

  if (errorValidacion) {
    return res.render('nueva', {
      empleado: req.empleado,
      error: errorValidacion,
      editando: true,
      token: req.params.token,
      valores: { ...b, folio: existente.folio, fecha_emision_input: b.fecha_emision },
      activo: 'dashboard'
    });
  }

  const campos = extraerCamposFormulario(b);
  const historialBuffer = req.file ? req.file.buffer : existente.historial_pdf;
  const historialNombre = req.file ? req.file.originalname : existente.historial_pdf_nombre;

  await query(
    `UPDATE constancias SET
      matricula=$1, nombre=$2, apellido_paterno=$3, apellido_materno=$4,
      programa=$5, plan_estudios=$6, promedio=$7, creditos_totales=$8, creditos_obtenidos=$9,
      ciclo_inicio=$10, ciclo_fin=$11, destinatario_nombre=$12, destinatario_cargo=$13,
      texto_adicional=$14, lugar_emision=$15, fecha_emision=$16,
      titulo_docente=$17, cargo_docente=$18, materias_titular=$19, materias_impartidas=$20,
      fecha_desde=$21, texto_destacado=$22, logros_adicionales=$23,
      historial_pdf=$24, historial_pdf_nombre=$25
    WHERE token = $26`,
    [
      campos.matricula, campos.nombre, campos.apellido_paterno, campos.apellido_materno,
      campos.programa, campos.plan_estudios, campos.promedio, campos.creditos_totales, campos.creditos_obtenidos,
      campos.ciclo_inicio, campos.ciclo_fin, campos.destinatario_nombre, campos.destinatario_cargo,
      campos.texto_adicional, campos.lugar_emision, b.fecha_emision || existente.fecha_emision,
      campos.titulo_docente, campos.cargo_docente, campos.materias_titular, campos.materias_impartidas,
      campos.fecha_desde, campos.texto_destacado, campos.logros_adicionales,
      historialBuffer, historialNombre, req.params.token
    ]
  );

  res.redirect('/dashboard');
}));

app.get('/constancias/:token/pdf', requireLogin, ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM constancias WHERE token = $1', [req.params.token]);
  const c = rows[0];
  if (!c) return res.status(404).send('Constancia no encontrada.');

  const verifyUrl = `${getBaseUrl(req)}/verify/${c.token}`;
  const bufferPrincipal = await generarConstanciaPDF(c, verifyUrl);
  const bufferFinal = await fusionarPDFs(bufferPrincipal, c.historial_pdf);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${c.folio}.pdf"`);
  res.send(bufferFinal);
}));

app.post('/constancias/:token/revocar', requireLogin, requireAdmin, ah(async (req, res) => {
  await query(`UPDATE constancias SET estado = 'revocada' WHERE token = $1`, [req.params.token]);
  res.redirect('/dashboard');
}));

app.get('/constancias/:token/qr.png', requireLogin, ah(async (req, res) => {
  const { rows } = await query('SELECT token FROM constancias WHERE token = $1', [req.params.token]);
  if (!rows[0]) return res.status(404).end();

  const verifyUrl = `${getBaseUrl(req)}/verify/${rows[0].token}`;
  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, verifyUrl, { width: 220, margin: 1 });
}));

// ================== GESTIÓN DE EMPLEADOS (solo administradores) ==================

app.get('/empleados', requireLogin, requireAdmin, ah(async (req, res) => {
  const { rows: empleados } = await query(
    'SELECT id, username, nombre_completo, puesto, rol, activo FROM empleados ORDER BY id ASC'
  );
  res.render('empleados', { empleado: req.empleado, empleados, error: null, activo: 'empleados' });
}));

app.get('/empleados/nuevo', requireLogin, requireAdmin, (req, res) => {
  res.render('empleados_nuevo', { empleado: req.empleado, error: null, valores: {}, activo: 'empleados' });
});

app.post('/empleados/nuevo', requireLogin, requireAdmin, ah(async (req, res) => {
  const b = req.body;

  if (!b.username || !b.password || !b.nombre_completo || !b.rol) {
    return res.render('empleados_nuevo', {
      empleado: req.empleado,
      error: 'Usuario, contraseña, nombre completo y rol son obligatorios.',
      valores: b,
      activo: 'empleados'
    });
  }

  const { rows: existentes } = await query('SELECT id FROM empleados WHERE username = $1', [b.username]);
  if (existentes.length > 0) {
    return res.render('empleados_nuevo', {
      empleado: req.empleado,
      error: `Ya existe un empleado con el usuario "${b.username}".`,
      valores: b,
      activo: 'empleados'
    });
  }

  const hash = bcrypt.hashSync(b.password, 10);
  await query(
    `INSERT INTO empleados (username, password_hash, nombre_completo, puesto, rol)
     VALUES ($1, $2, $3, $4, $5)`,
    [b.username, hash, b.nombre_completo, b.puesto || '', b.rol]
  );

  res.redirect('/empleados');
}));

app.post('/empleados/:id/desactivar', requireLogin, requireAdmin, ah(async (req, res) => {
  await query('UPDATE empleados SET activo = FALSE WHERE id = $1', [req.params.id]);
  res.redirect('/empleados');
}));

app.post('/empleados/:id/activar', requireLogin, requireAdmin, ah(async (req, res) => {
  await query('UPDATE empleados SET activo = TRUE WHERE id = $1', [req.params.id]);
  res.redirect('/empleados');
}));

// ================== VERIFICACIÓN PÚBLICA (sin login) ==================

app.get('/verify/:token', ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM constancias WHERE token = $1', [req.params.token]);
  const c = rows[0] || null;

  await query(
    `INSERT INTO verificaciones_log (constancia_id, token_consultado, encontrada, ip)
     VALUES ($1, $2, $3, $4)`,
    [c ? c.id : null, req.params.token, !!c, req.ip]
  );

  if (!c) {
    return res.status(404).render('verify', { encontrada: false, revocada: false, c: null });
  }

  res.render('verify', { encontrada: true, revocada: c.estado === 'revocada', c });
}));

app.get('/', (req, res) => res.redirect('/login'));

// Manejador de errores: si cualquier ruta async truena (ej. no logra conectar
// a la base de datos), esto responde de inmediato en vez de dejar la petición
// colgada hasta que la plataforma la corte con un 504.
app.use((err, req, res, next) => {
  console.error('Error no manejado en una ruta:', err);
  if (res.headersSent) return next(err);
  res.status(500).send(
    'Ocurrió un error en el servidor al procesar tu solicitud. ' +
    'Intenta de nuevo en unos segundos; si el problema sigue, avisa al administrador.'
  );
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor local en http://localhost:${PORT}`));
}

module.exports = app;
