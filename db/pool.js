const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('ADVERTENCIA: no se encontró POSTGRES_URL ni DATABASE_URL en las variables de entorno.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('localhost')
    ? false
    : { rejectUnauthorized: false } // necesario para Supabase/Neon en la mayoría de los casos
});

// Helper con la misma forma que usábamos antes ({ rows })
async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { pool, query };
