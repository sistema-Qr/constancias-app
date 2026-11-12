const crypto = require('crypto');

// Sello digital de la constancia. Mismo mecanismo que el "sello digital" de un CFDI:
// se arma una "cadena original" con los datos de la constancia y se firma con RSA-SHA256
// usando la llave privada de la institución (variable de entorno SELLO_PRIVATE_KEY).
// La firma RSA PKCS#1 v1.5 es determinística: los mismos datos siempre dan el mismo sello.
// Si la variable no está configurada, el sistema funciona igual que antes (sin sello).

let llaveCache; // undefined = aún no cargada; null = no hay llave configurada

function llavePrivada() {
  if (llaveCache !== undefined) return llaveCache;
  const pem = (process.env.SELLO_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (!pem) {
    llaveCache = null;
    return llaveCache;
  }
  try {
    llaveCache = crypto.createPrivateKey(pem);
  } catch (err) {
    console.warn('SELLO_PRIVATE_KEY no es una llave privada válida:', err.message);
    llaveCache = null;
  }
  return llaveCache;
}

function limpiar(valor) {
  return String(valor == null ? '' : valor).replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}

function fechaLocal(d) {
  if (!(d instanceof Date)) return limpiar(d).slice(0, 10);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function fechaHoraISO(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 19) + 'Z';
}

// Solo incluye datos que ya aparecen impresos en la constancia (nunca el CURP).
function construirCadenaOriginal(c) {
  const nombre = [c.nombre, c.apellido_paterno, c.apellido_materno].filter(Boolean).join(' ').toUpperCase();
  const programa = c.programa || c.plan_estudios || '';
  const campos = [
    '1.0', c.folio, c.tipo, nombre, c.matricula || '', programa,
    fechaLocal(c.fecha_emision), fechaHoraISO(c.creado_en || c.fecha_emision)
  ];
  return '||' + campos.map(limpiar).join('|') + '||';
}

function llavePublica() {
  const privada = llavePrivada();
  return privada ? crypto.createPublicKey(privada) : null;
}

function llavePublicaPEM() {
  const publica = llavePublica();
  return publica ? publica.export({ type: 'spki', format: 'pem' }) : null;
}

// Identificador corto de la llave (equivalente al "No. de serie del certificado").
function idLlave() {
  const publica = llavePublica();
  if (!publica) return null;
  const der = publica.export({ type: 'spki', format: 'der' });
  const hex = crypto.createHash('sha256').update(der).digest('hex').toUpperCase().slice(0, 20);
  return hex.match(/.{4}/g).join('-');
}

function generarSello(c) {
  const llave = llavePrivada();
  if (!llave) return null;
  const cadena = construirCadenaOriginal(c);
  const base64 = crypto.sign('RSA-SHA256', Buffer.from(cadena, 'utf8'), llave).toString('base64');
  return {
    cadena,
    base64,
    // Huella corta que va dentro del QR (equivale a los últimos dígitos del sello en un CFDI).
    huella: crypto.createHash('sha256').update(base64).digest('hex').slice(0, 12),
    llaveId: idLlave(),
    fechaCertificacion: fechaHoraISO(c.creado_en || c.fecha_emision)
  };
}

module.exports = { generarSello, construirCadenaOriginal, llavePublicaPEM };
