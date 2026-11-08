const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'sesion';

if (!SECRET) {
  console.warn('ADVERTENCIA: JWT_SECRET no está definido. Configúralo en las variables de entorno.');
}

function crearTokenSesion(empleado) {
  return jwt.sign(
    {
      id: empleado.id,
      username: empleado.username,
      nombre_completo: empleado.nombre_completo,
      rol: empleado.rol
    },
    SECRET || 'secreto-temporal-inseguro',
    { expiresIn: '8h' }
  );
}

function ponerCookieSesion(res, empleado) {
  const token = crearTokenSesion(empleado);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8 horas
  });
}

function borrarCookieSesion(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireLogin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.redirect('/login');

  try {
    req.empleado = jwt.verify(token, SECRET || 'secreto-temporal-inseguro');
    next();
  } catch (err) {
    borrarCookieSesion(res);
    return res.redirect('/login');
  }
}

// Debe usarse SIEMPRE después de requireLogin en la cadena de middlewares.
function requireAdmin(req, res, next) {
  if (!req.empleado || req.empleado.rol !== 'admin') {
    return res.status(403).send('No tienes permiso para acceder a esta sección. Contacta a un administrador.');
  }
  next();
}

module.exports = { ponerCookieSesion, borrarCookieSesion, requireLogin, requireAdmin, COOKIE_NAME };
