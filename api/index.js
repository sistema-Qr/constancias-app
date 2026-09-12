// Carga variables de entorno locales (.env.development.local) si existen.
// En Vercel las variables ya vienen inyectadas y esta llamada no hace nada.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.development.local') });

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { sql } = require('@vercel/postgres');

const { ponerCookieSesion, borrarCookieSesion, requireLogin } = require('../lib/auth');
const { generarConstanciaPDF } = require('../lib/pdfConstancia');

const app = express();
const ROOT = path.join(__dirname, '..');

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
  const { rows } = await sql`
    SELECT COUNT(*)::int AS n FROM constancias WHERE folio LIKE ${'CUEJ-' + anio + '-%'}
  `;
  const consecutivo = String(rows[0].n + 1).padStart(4, '0');
  return `CUEJ-${anio}-${consecutivo}`;
}

// ================== AUTENTICACIÓN ==================

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await sql`
    SELECT * FROM empleados WHERE username = ${username} AND activo = TRUE
  `;
  const empleado = rows[0];

  if (!empleado || !bcrypt.compareSync(password, empleado.password_hash)) {
    return res.render('login', { error: 'Usuario o contraseña incorrectos.' });
  }

  ponerCookieSesion(res, empleado);
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  borrarCookieSesion(res);
  res.redirect('/login');
});

// ================== PANEL DE EMPLEADOS (protegido) ==================

app.get('/dashboard', requireLogin, async (req, res) => {
  const { rows: constancias } = await sql`
    SELECT c.*, e.nombre_completo AS emitido_por_nombre
    FROM constancias c
    JOIN empleados e ON e.id = c.emitido_por
    ORDER BY c.id DESC
    LIMIT 100
  `;
  res.render('dashboard', { empleado: req.empleado, constancias });
});

app.get('/constancias/nueva', requireLogin, (req, res) => {
  res.render('nueva', { empleado: req.empleado, error: null, valores: {} });
});

app.post('/constancias/nueva', requireLogin, async (req, res) => {
  const b = req.body;

  if (!b.nombre || !b.apellido_paterno || !b.matricula || !b.programa) {
    return res.render('nueva', {
      empleado: req.empleado,
      error: 'Nombre, apellido paterno, matrícula y programa son obligatorios.',
      valores: b
    });
  }

  const folio = await generarFolio();
  const token = uuidv4();
  const fechaEmision = b.fecha_emision || new Date().toISOString().slice(0, 10);

  await sql`
    INSERT INTO constancias (
      folio, token, matricula, nombre, apellido_paterno, apellido_materno,
      programa, plan_estudios, promedio, creditos_totales, creditos_obtenidos,
      ciclo_inicio, ciclo_fin, destinatario_nombre, destinatario_cargo,
      texto_adicional, lugar_emision, fecha_emision, emitido_por
    ) VALUES (
      ${folio}, ${token}, ${b.matricula}, ${b.nombre}, ${b.apellido_paterno}, ${b.apellido_materno || ''},
      ${b.programa}, ${b.plan_estudios || ''}, ${b.promedio || ''}, ${b.creditos_totales || ''}, ${b.creditos_obtenidos || ''},
      ${b.ciclo_inicio || ''}, ${b.ciclo_fin || ''}, ${b.destinatario_nombre || ''}, ${b.destinatario_cargo || ''},
      ${b.texto_adicional || ''}, ${b.lugar_emision || 'Ciudad de México'}, ${fechaEmision}, ${req.empleado.id}
    )
  `;

  res.redirect('/dashboard');
});

app.get('/constancias/:token/pdf', requireLogin, async (req, res) => {
  const { rows } = await sql`SELECT * FROM constancias WHERE token = ${req.params.token}`;
  const c = rows[0];
  if (!c) return res.status(404).send('Constancia no encontrada.');

  const verifyUrl = `${getBaseUrl(req)}/verify/${c.token}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${c.folio}.pdf"`);
  await generarConstanciaPDF(c, verifyUrl, res);
});

app.post('/constancias/:token/revocar', requireLogin, async (req, res) => {
  await sql`UPDATE constancias SET estado = 'revocada' WHERE token = ${req.params.token}`;
  res.redirect('/dashboard');
});

app.get('/constancias/:token/qr.png', requireLogin, async (req, res) => {
  const { rows } = await sql`SELECT token FROM constancias WHERE token = ${req.params.token}`;
  if (!rows[0]) return res.status(404).end();

  const verifyUrl = `${getBaseUrl(req)}/verify/${rows[0].token}`;
  res.setHeader('Content-Type', 'image/png');
  QRCode.toFileStream(res, verifyUrl, { width: 220, margin: 1 });
});

// ================== VERIFICACIÓN PÚBLICA (sin login) ==================

app.get('/verify/:token', async (req, res) => {
  const { rows } = await sql`SELECT * FROM constancias WHERE token = ${req.params.token}`;
  const c = rows[0] || null;

  await sql`
    INSERT INTO verificaciones_log (constancia_id, token_consultado, encontrada, ip)
    VALUES (${c ? c.id : null}, ${req.params.token}, ${!!c}, ${req.ip})
  `;

  if (!c) {
    return res.status(404).render('verify', { encontrada: false, revocada: false, c: null });
  }

  res.render('verify', { encontrada: true, revocada: c.estado === 'revocada', c });
});

app.get('/', (req, res) => res.redirect('/login'));

// En local: node api/index.js levanta un servidor normal.
// En Vercel: se exporta `app` y Vercel lo invoca como función serverless.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor local en http://localhost:${PORT}`));
}

module.exports = app;
