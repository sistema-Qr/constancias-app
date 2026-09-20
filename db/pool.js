cat > db/pool.js << 'EOF'
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

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
EOF
echo "pool.js actualizado"