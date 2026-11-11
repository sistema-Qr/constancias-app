// Catálogo de programas de CUEJ: RVOE y estructura de cada programa.
// Las llaves deben coincidir EXACTAMENTE con los nombres del desplegable del formulario.
// Los datos en null aún no están capturados: el PDF omite esa parte en vez de inventarla.
const PROGRAMAS = {
  "Licenciatura en Derecho": { rvoe: "20211348", rvoeFecha: "12 de agosto de 2021", periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Licenciatura en Vista Aduanal y Comercio Exterior": { rvoe: "20220305", rvoeFecha: "22 de abril de 2022", periodos: "siete semestres", duracion: "tres años y medio", asignaturas: 42, creditos: "308" },
  "Licenciatura en Contaduría": { rvoe: "20250434", rvoeFecha: "26 de marzo de 2025", periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Licenciatura en Derecho (No escolarizada / En línea)": { rvoe: "20252446", rvoeFecha: "11 de agosto de 2025", periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Sanitario y Médico": { rvoe: null, rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Aduanero y Derecho de Comercio Exterior": { rvoe: "20150103", rvoeFecha: "7 de abril de 2015", periodos: "seis cuatrimestres", duracion: "dos años", asignaturas: 18, creditos: "78.75" },
  "Maestría en Derecho Civil y Familiar": { rvoe: "20181226", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Constitucional": { rvoe: "20150104", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Fiscal y Administrativo": { rvoe: "20121644", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Sistema Acusatorio y Juicios Penales Orales": { rvoe: "20150061", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Marítimo y Derecho Portuario": { rvoe: "20220306", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Filosofía e Historia": { rvoe: "20220304", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Maestría en Derecho Aduanero y Derecho de Comercio Exterior (No escolarizado)": { rvoe: null, rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Doctorado en Derecho": { rvoe: "20130002", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Doctorado en Derecho Aduanero y Derecho de Comercio Exterior": { rvoe: "20192323", rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Doctorado en Derecho Fiscal": { rvoe: null, rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Doctorado en Derechos Humanos y Derecho Constitucional": { rvoe: null, rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
  "Doctorado en Derecho Aduanero y Derecho de Comercio Exterior (No escolarizado)": { rvoe: null, rvoeFecha: null, periodos: null, duracion: null, asignaturas: null, creditos: null },
};

function nivelDe(programa) {
  const p = (programa || '').toLowerCase();
  if (p.startsWith('licenciatura')) return 'licenciatura';
  if (p.startsWith('maestr')) return 'maestría';
  if (p.startsWith('doctorado')) return 'doctorado';
  return null;
}

function datosPrograma(programa) {
  return PROGRAMAS[programa] || {};
}

module.exports = { PROGRAMAS, nivelDe, datosPrograma };
