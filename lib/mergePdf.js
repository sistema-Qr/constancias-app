const { PDFDocument } = require('pdf-lib');

// Une el PDF principal (la carta) con un PDF adicional (historial académico), en ese orden.
// Si no hay PDF adicional, regresa el principal tal cual.
async function fusionarPDFs(bufferPrincipal, bufferAdicional) {
  if (!bufferAdicional) return bufferPrincipal;

  const docFinal = await PDFDocument.create();

  const principal = await PDFDocument.load(bufferPrincipal);
  const paginasPrincipal = await docFinal.copyPages(principal, principal.getPageIndices());
  paginasPrincipal.forEach((p) => docFinal.addPage(p));

  const adicional = await PDFDocument.load(bufferAdicional);
  const paginasAdicionales = await docFinal.copyPages(adicional, adicional.getPageIndices());
  paginasAdicionales.forEach((p) => docFinal.addPage(p));

  return Buffer.from(await docFinal.save());
}

module.exports = { fusionarPDFs };
