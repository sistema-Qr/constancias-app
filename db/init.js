// Ejecuta el esquema contra la base configurada en POSTGRES_URL.
// Uso local:  npx vercel env pull .env.development.local --environment=production
//             npm run db:init
require('dotenv').config({ path: '.env.development.local' });
const { query, pool } = require('./pool');
const statements = require('./schema');

async function main() {
  for (const stmt of statements) {
    await query(stmt);
  }
  console.log('Tablas creadas/verificadas correctamente en Postgres.');
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Error inicializando la base de datos:', err);
  await pool.end();
  process.exit(1);
});
