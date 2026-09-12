const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const INSTITUCION = {
  nombreLinea1: 'CENTRO UNIVERSITARIO',
  nombreLinea2: 'DE ESTUDIOS JURÍDICOS',
  direccion: 'Municipio Libre 103 Col. Portales Norte, Delegación Benito Juárez, C.P. 03303, Ciudad de México',
  telefonos: 'Teléfonos: 5575-9840, 56-72-20-20, 5243-0290 y 5998-8186',
  colorAzul: '#1a2f6e'
};

/**
 * Genera el PDF de una constancia y lo escribe en el stream de respuesta (res) o
 * en cualquier writable stream que se le pase.
 * @param {object} c fila de la tabla constancias
 * @param {string} verifyUrl URL pública de verificación que se codifica en el QR
 * @param {import('stream').Writable} outputStream
 */
async function generarConstanciaPDF(c, verifyUrl, outputStream) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
  doc.pipe(outputStream);

  // ---- Encabezado ----
  doc
    .fillColor(INSTITUCION.colorAzul)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(INSTITUCION.nombreLinea1, { align: 'right' })
    .text(INSTITUCION.nombreLinea2, { align: 'right' });

  doc.moveDown(2);
  doc.fillColor('black').font('Helvetica').fontSize(11);

  const fecha = new Date(c.fecha_emision + 'T00:00:00');
  const fechaTexto = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`${c.lugar_emision} a ${fechaTexto}.`, { align: 'left' });
  doc.moveDown(1.2);

  if (c.destinatario_nombre) {
    doc.font('Helvetica-Bold').text(c.destinatario_nombre + ',');
  }
  if (c.destinatario_cargo) {
    doc.font('Helvetica-Bold').text(c.destinatario_cargo);
  }
  doc.moveDown(1);

  const nombreCompleto = `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno || ''}`.trim();

  doc.font('Helvetica').text(
    `Por medio de la presente, se hace constar que el C. `,
    { continued: true }
  );
  doc.font('Helvetica-Bold').text(nombreCompleto.toUpperCase() + ', ', { continued: true });
  doc.font('Helvetica').text(
    `con número de matrícula ${c.matricula} ha concluido satisfactoriamente el programa de la `,
    { continued: true }
  );
  doc.font('Helvetica-Bold').text(c.programa.toUpperCase() + '. ', { continued: false });

  doc.moveDown(0.8);

  if (c.plan_estudios) {
    doc.font('Helvetica').text(`Plan de estudios: ${c.plan_estudios}.`);
    doc.moveDown(0.5);
  }

  if (c.ciclo_inicio && c.ciclo_fin) {
    doc.text(`El alumno cursó el programa antes mencionado del ciclo escolar ${c.ciclo_inicio} a ${c.ciclo_fin}.`);
    doc.moveDown(0.5);
  }

  if (c.promedio) {
    doc.text(`Promedio general obtenido: ${c.promedio}.`);
    doc.moveDown(0.5);
  }

  if (c.creditos_obtenidos && c.creditos_totales) {
    doc.text(`Créditos cubiertos: ${c.creditos_obtenidos} de ${c.creditos_totales}.`);
    doc.moveDown(0.5);
  }

  if (c.texto_adicional) {
    doc.moveDown(0.3);
    doc.text(c.texto_adicional);
  }

  doc.moveDown(1);
  doc.text('Se extiende la presente, a solicitud del interesado, para los fines lícitos que a él le correspondan.');

  doc.moveDown(3);
  doc.font('Helvetica-Bold').text('ATENTAMENTE', { align: 'center' });
  doc.moveDown(2.5);
  doc.text('_________________________________', { align: 'center' });
  doc.text('DIRECCIÓN ACADÉMICA', { align: 'center' });

  // ---- QR de verificación ----
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
  const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  const qrY = doc.page.height - 200;
  doc.image(qrImageBuffer, doc.page.width - 56 - 110, qrY, { width: 110 });

  doc
    .font('Helvetica')
    .fontSize(8)
    .text('Escanea para verificar la autenticidad', doc.page.width - 56 - 130, qrY + 112, { width: 150, align: 'center' })
    .text(`Folio: ${c.folio}`, doc.page.width - 56 - 130, qrY + 124, { width: 150, align: 'center' });

  // ---- Pie de página ----
  doc
    .fontSize(8)
    .fillColor('gray')
    .text(INSTITUCION.direccion, 56, doc.page.height - 60, { width: doc.page.width - 112, align: 'center' })
    .text(INSTITUCION.telefonos, { width: doc.page.width - 112, align: 'center' });

  doc.end();
}

module.exports = { generarConstanciaPDF };
