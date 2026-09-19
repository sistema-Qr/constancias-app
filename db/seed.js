// Crea el usuario administrador inicial.
require('dotenv').config({ path: '.env.development.local' });
const bcrypt = require('bcryptjs');
const { query, pool } = require('./pool');

const username = 'admin';
const passwordPlano = 'admin123';

async function main() {
  const { rows } = await query('SELECT id FROM empleados WHERE username = $1', [username]);

  if (rows.length > 0) {
    console.log(`El usuario "${username}" ya existe. No se creó ninguno nuevo.`);
    await pool.end();
    return;
  }

  const hash = bcrypt.hashSync(passwordPlano, 10);
  await query(
    `INSERT INTO empleados (username, password_hash, nombre_completo, puesto, rol)
     VALUES ($1, $2, $3, $4, 'admin')`,
    [username, hash, 'Administrador del Sistema', 'Control Escolar']
  );

  console.log('Usuario administrador creado:');
  console.log(`  usuario:  ${username}`);
  console.log(`  password: ${passwordPlano}`);
  console.log('IMPORTANTE: cambia esta contraseña antes de usarlo con datos reales.');
  await pool.end();
}

main().then(() => process.exit(0)).catch(async (err) => {
  console.error('Error creando el usuario admin:', err);
  await pool.end();
  process.exit(1);
});
