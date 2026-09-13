const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const INSTITUCION = {
  nombreLinea1: 'CENTRO UNIVERSITARIO',
  nombreLinea2: 'DE ESTUDIOS JURÍDICOS',
  direccion: 'Municipio Libre 103 Col. Portales Norte, Delegación Benito Juárez, C.P. 03303, Ciudad de México',
  telefonos: 'Teléfonos: 5575-9840, 56-72-20-20, 5243-0290 y 5998-8186',
  colorAzul: '#1a2f6e'
};

const FIRMANTE = {
  nombre: 'MTRA. FABIOLA FLORES TÉLLEZ',
  puesto: 'DIRECTORA ACADÉMICA',
  institucion: 'CENTRO UNIVERSITARIO DE ESTUDIOS JURÍDICO',
  imagen: path.join(__dirname, '..', 'public', 'img', 'firma_directora.png'),
  imagenRelacionAspecto: 291 / 310
};

function formatearFecha(fechaEmision) {
  const fecha = fechaEmision instanceof Date
    ? fechaEmision
    : new Date(fechaEmision + 'T00:00:00');

  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function generarConstanciaPDF(c, verifyUrl, outputStream) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
  doc.pipe(outputStream);

  doc
    .fillColor(INSTITUCION.colorAzul)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(INSTITUCION.nombreLinea1, { align: 'right' })
    .text(INSTITUCION.nombreLinea2, { align: 'right' });

  doc.moveDown(2);
  doc.fillColor('black').font('Helvetica').fontSize(11);

  const fechaTexto = formatearFecha(c.fecha_emision);
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

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(11).text('ATENTAMENTE', { align: 'center' });

  const firmaWidth = 130;
  const firmaHeight = firmaWidth * FIRMANTE.imagenRelacionAspecto;
  const firmaX = (doc.page.width - firmaWidth) / 2;
  const firmaY = doc.y + 6;

  try {
    doc.image(FIRMANTE.imagen, firmaX, firmaY, { width: firmaWidth });
  } catch (err) {
    console.warn('No se pudo cargar la imagen de la firma:', err.message);
  }

  doc.y = firmaY + firmaHeight - 18;
  doc.x = 56;

  doc.font('Helvetica').fontSize(11);
  doc.text('_________________________________', { align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(FIRMANTE.nombre, { align: 'center' });
  doc.font('Helvetica').fontSize(10);
  doc.text(FIRMANTE.puesto, { align: 'center' });
  doc.text(FIRMANTE.institucion, { align: 'center' });

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
  const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  const qrY = doc.page.height - 200;
  doc.image(qrImageBuffer, doc.page.width - 56 - 110, qrY, { width: 110 });

  doc
    .font('Helvetica')
    .fontSize(8)
    .text('Escanea para verificar la autenticidad', doc.page.width - 56 - 130, qrY + 112, { width: 150, align: 'center' })
    .text(`Folio: ${c.folio}`, doc.page.width - 56 - 130, qrY + 124, { width: 150, align: 'center' });

  const margenInferiorOriginal = doc.page.margins.bottom;
  doc.page.margins.bottom = 20;

  doc
    .fontSize(8)
    .fillColor('gray')
    .text(INSTITUCION.direccion, 56, doc.page.height - 50, { width: doc.page.width - 112, align: 'center', lineBreak: true })
    .text(INSTITUCION.telefonos, 56, doc.page.height - 38, { width: doc.page.width - 112, align: 'center', lineBreak: true });

  doc.page.margins.bottom = margenInferiorOriginal;

  doc.end();
}

module.exports = { generarConstanciaPDF };
