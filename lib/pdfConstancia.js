const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const INSTITUCION = {
  direccion: 'Municipio Libre 103 Col. Portales Norte, Delegación Benito Juárez, C.P. 03303, Ciudad de México',
  telefonos: 'Teléfonos: 5575-9840, 56-72-20-20, 5243-0290 y 5998-8186',
  colorAzul: '#19285a',
  logo: path.join(__dirname, '..', 'public', 'img', 'logo_cuej.png'),
  logoRelacionAspecto: 344 / 814
};

const FIRMANTE = {
  nombre: 'MTRA. FABIOLA FLORES TÉLLEZ',
  nombrePropio: 'Fabiola Flores Téllez',
  puesto: 'DIRECTORA ACADÉMICA',
  institucion: 'CENTRO UNIVERSITARIO DE ESTUDIOS JURÍDICO',
  imagen: path.join(__dirname, '..', 'public', 'img', 'firma_directora.png'),
  imagenRelacionAspecto: 291 / 310
};

const TEXTO_RVOE = `${FIRMANTE.nombrePropio}, en mi carácter de Directora Académica del Centro Universitario de Estudios Jurídicos, que es una escuela particular incorporada al Sistema Educativo Nacional y cuenta con Reconocimientos de Validez Oficial de Estudios ante la Secretaría de Educación Pública, cuenta con las Licenciaturas: en Derecho RVOE 20211348 y en Vista Aduanal y Comercio Exterior RVOE 20220305; las Maestrías: en Derecho Fiscal y Administrativo RVOE 20121644, en Derecho Aduanero y Derecho Comercio Exterior RVOE 20150103, en Sistema Acusatorio y Juicios Penales Orales RVOE 20150061, en Derecho Constitucional RVOE 20150104, en Derecho Civil y Familiar RVOE 20181226, en Derecho Marítimo y Derecho Portuario RVOE 20220306, en Filosofía e Historia RVOE 20220304; el Doctorado en Derecho RVOE 20130002 y Doctorado en Derecho Aduanero y Derecho de Comercio Exterior RVOE 20192323.`;

function formatearFecha(fechaEmision) {
  const fecha = fechaEmision instanceof Date
    ? fechaEmision
    : new Date(fechaEmision + 'T00:00:00');

  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function dibujarEncabezado(doc) {
  const logoWidth = 170;
  const logoHeight = logoWidth * INSTITUCION.logoRelacionAspecto;
  try {
    doc.image(INSTITUCION.logo, doc.page.width - 56 - logoWidth, 40, { width: logoWidth });
  } catch (err) {
    console.warn('No se pudo cargar el logo:', err.message);
  }
  doc.y = 40 + logoHeight + 38;
  doc.x = 56;
  doc.fillColor('black').font('Helvetica').fontSize(11);
}

// Fecha de emisión, alineada a la derecha (antes iba a la izquierda).
function dibujarFecha(doc, c) {
  const fechaTexto = formatearFecha(c.fecha_emision);
  doc.text(`${c.lugar_emision} a ${fechaTexto}.`, { align: 'right' });
  doc.moveDown(1.2);
}

async function dibujarFirmaQRYPie(doc, c, verifyUrl) {
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
}

// Verbo/frase principal según el tipo de constancia de alumno.
// "servicio_social" usa un texto temporal hasta que la institución mande el formato oficial.
function fraseTipoAlumno(tipo) {
  if (tipo === 'avance') {
    return 'actualmente se encuentra cursando el programa de la';
  }
  if (tipo === 'servicio_social') {
    return 'actualmente se encuentra realizando su Servicio Social dentro del programa de la';
  }
  return 'ha concluido satisfactoriamente el programa de la'; // término
}

// ---------- Constancia de TÉRMINO, AVANCE o SERVICIO SOCIAL ----------
async function generarConstanciaAlumnoPDF(c, verifyUrl) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56, bufferPages: true });
  dibujarEncabezado(doc);
  dibujarFecha(doc, c);

  if (c.destinatario_nombre) {
    doc.font('Helvetica-Bold').text(c.destinatario_nombre + ',');
  }
  if (c.destinatario_cargo) {
    doc.font('Helvetica-Bold').text(c.destinatario_cargo);
  }
  doc.moveDown(1);

  const nombreCompleto = `${c.nombre} ${c.apellido_paterno} ${c.apellido_materno || ''}`.trim();
  const esAvance = c.tipo === 'avance';

  doc.font('Helvetica').text(`Por medio de la presente, se hace constar que C. `, { continued: true });
  doc.font('Helvetica-Bold').text(nombreCompleto.toUpperCase() + ', ', { continued: true });
  doc.font('Helvetica').text(
    `con número de matrícula ${c.matricula} ${fraseTipoAlumno(c.tipo)} `,
    { continued: true }
  );
  doc.font('Helvetica-Bold').text((c.programa || '').toUpperCase() + '. ', { continued: false });

  doc.moveDown(0.8);

  if (c.plan_estudios) {
    doc.font('Helvetica').text(`${c.plan_estudios}.`);
    doc.moveDown(0.5);
  }

  if (c.ciclo_inicio && c.ciclo_fin) {
    const verbo = esAvance ? 'cursa' : 'cursó';
    doc.text(`El alumno ${verbo} el programa antes mencionado del ciclo escolar ${c.ciclo_inicio} a ${c.ciclo_fin}.`);
    doc.moveDown(0.5);
  }

  if (c.promedio) {
    doc.text(`${c.promedio}.`);
    doc.moveDown(0.5);
  }

  if (c.creditos_obtenidos && c.creditos_totales) {
    const etiqueta = esAvance ? 'Avance de créditos' : 'Créditos cubiertos';
    doc.text(`${etiqueta}: ${c.creditos_obtenidos} de ${c.creditos_totales}.`);
    doc.moveDown(0.5);
  }

  if (c.texto_adicional) {
    doc.moveDown(0.3);
    doc.text(c.texto_adicional);
  }

  doc.moveDown(1);
  doc.text('Se extiende la presente, a solicitud del interesado, para los fines lícitos que a él le correspondan.');

  await dibujarFirmaQRYPie(doc, c, verifyUrl);

  return docToBuffer(doc);
}

// ---------- Constancia de DOCENTE ----------
async function generarConstanciaDocentePDF(c, verifyUrl) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56, bufferPages: true });
  dibujarEncabezado(doc);
  dibujarFecha(doc, c);

  doc.font('Helvetica-Bold').fontSize(11).text('A QUIEN CORRESPONDA:', { align: 'left' });
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(11).text(TEXTO_RVOE, { align: 'justify' });
  doc.moveDown(0.8);

  const nombreDocente = `${c.titulo_docente ? c.titulo_docente + ' ' : ''}${c.nombre} ${c.apellido_paterno} ${c.apellido_materno || ''}`.trim();

  doc.text(`Por medio de la presente, se hace constar que ${nombreDocente}, es ${c.cargo_docente || 'catedrática/o'} del Centro Universitario de Estudios Jurídicos`, { continued: true });

  if (c.plan_estudios) {
    doc.text(` en el plan de estudios de ${c.plan_estudios}`, { continued: true });
  }

  if (c.materias_titular) {
    doc.text(`, donde es titular de las materias: ${c.materias_titular}`, { continued: true });
  }

  if (c.materias_impartidas) {
    doc.text(`; además ha impartido las materias de ${c.materias_impartidas}`, { continued: true });
  }

  if (c.fecha_desde) {
    doc.text(` desde ${c.fecha_desde} a la fecha.`, { continued: false });
  } else {
    doc.text('.', { continued: false });
  }

  if (c.texto_destacado) {
    doc.moveDown(0.8);
    doc.text(c.texto_destacado, { align: 'justify' });
  }

  if (c.logros_adicionales) {
    doc.moveDown(0.8);
    doc.text(c.logros_adicionales, { align: 'justify' });
  }

  doc.moveDown(1);
  doc.text('Lo anterior, para todos los efectos legales a que haya lugar.');

  await dibujarFirmaQRYPie(doc, c, verifyUrl);

  return docToBuffer(doc);
}

async function generarConstanciaPDF(c, verifyUrl) {
  if (c.tipo === 'docente') {
    return generarConstanciaDocentePDF(c, verifyUrl);
  }
  // término, avance y servicio_social comparten el mismo formato de carta
  return generarConstanciaAlumnoPDF(c, verifyUrl);
}

module.exports = { generarConstanciaPDF };
