// Crea el usuario administrador inicial en Postgres.
require('dotenv').config({ path: '.env.development.local' });
const bcrypt = require('bcryptjs');
const { sql } = require('@vercel/postgres');

const username = 'admin';
const passwordPlano = 'admin123';

async function main() {
  const existe = await sql`SELECT id FROM empleados WHERE username = ${username}`;

  if (existe.rows.length > 0) {
    console.log(`El usuario "${username}" ya existe. No se creó ninguno nuevo.`);
    return;
  }

  const hash = bcrypt.hashSync(passwordPlano, 10);
  await sql`
    INSERT INTO empleados (username, password_hash, nombre_completo, puesto)
    VALUES (${username}, ${hash}, 'Administrador del Sistema', 'Control Escolar')
  `;

  console.log('Usuario administrador creado:');
  console.log(`  usuario:  ${username}`);
  console.log(`  password: ${passwordPlano}`);
  console.log('IMPORTANTE: cambia esta contraseña antes de usarlo con datos reales.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Error creando el usuario admin:', err);
  process.exit(1);
});
