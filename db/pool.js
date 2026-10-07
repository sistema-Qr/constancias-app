const { Pool } = require('pg');

// Quita cualquier parámetro "sslmode" que venga en la cadena de conexión.
// Versiones recientes de pg-connection-string interpretan sslmode=require/prefer
// como si pidiéramos verificación estricta del certificado (verify-full), lo que
// rompe la conexión contra Supabase (certificado autofirmado) ignorando la opción
// "rejectUnauthorized: false" que le pasamos abajo. Al quitarlo, esa opción manda sin ambigüedad.
function limpiarConnectionString(cs) {
  if (!cs) return cs;
  try {
    const url = new URL(cs);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch (err) {
    console.warn('No se pudo parsear POSTGRES_URL para limpiar sslmode:', err.message);
    return cs;
  }
}

const connectionString = limpiarConnectionString(process.env.POSTGRES_URL || process.env.DATABASE_URL);

if (!connectionString) {
  console.warn('ADVERTENCIA: no se encontró POSTGRES_URL ni DATABASE_URL en las variables de entorno.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { pool, query };
