// Genera la llave del sello digital. Se corre UNA sola vez, en tu computadora:
//     node scripts/generar-llaves-sello.js
// Copia el valor que imprime a la variable de entorno SELLO_PRIVATE_KEY
// (en .env.development.local y en Vercel). No lo compartas ni lo subas a GitHub.
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();

console.log('\nCopia TODA la línea siguiente (incluye el nombre de la variable):\n');
console.log('SELLO_PRIVATE_KEY="' + pem.replace(/\n/g, '\\n') + '"');
console.log('\nGuárdala en un lugar seguro: quien tenga esta llave puede emitir sellos válidos.');
console.log('Si la pierdes o la cambias, los QR ya impresos mostrarán un aviso de que no coinciden.\n');
