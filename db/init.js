// Ejecuta el esquema contra la base configurada en POSTGRES_URL.
// Uso local:  vercel env pull .env.development.local   (trae la URL de la BD)
//             npm run db:init
require('dotenv').config({ path: '.env.development.local' });
const { sql } = require('@vercel/postgres');
const statements = require('./schema');

async function main() {
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('Tablas creadas/verificadas correctamente en Postgres.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error inicializando la base de datos:', err);
  process.exit(1);
});
