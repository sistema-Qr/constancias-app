// Sentencias DDL para Postgres. Se ejecutan una por una desde db/init.js.
// Son idempotentes (usan IF NOT EXISTS / DROP NOT NULL) para poder correrse varias veces sin romper nada.
module.exports = [
  `CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    puesto TEXT,
    rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `ALTER TABLE empleados ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'usuario'`,
  `UPDATE empleados SET rol = 'admin' WHERE username = 'admin'`,

  `CREATE TABLE IF NOT EXISTS constancias (
    id SERIAL PRIMARY KEY,
    folio TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'termino' CHECK (tipo IN ('termino', 'avance', 'docente')),
    matricula TEXT,
    nombre TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    programa TEXT,
    plan_estudios TEXT,
    promedio TEXT,
    creditos_totales TEXT,
    creditos_obtenidos TEXT,
    ciclo_inicio TEXT,
    ciclo_fin TEXT,
    destinatario_nombre TEXT,
    destinatario_cargo TEXT,
    texto_adicional TEXT,
    lugar_emision TEXT NOT NULL DEFAULT 'Ciudad de México',
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    emitido_por INTEGER NOT NULL REFERENCES empleados(id),
    estado TEXT NOT NULL DEFAULT 'activa',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Campos exclusivos de constancia de docente
    titulo_docente TEXT,
    cargo_docente TEXT,
    materias_titular TEXT,
    materias_impartidas TEXT,
    fecha_desde TEXT,
    texto_destacado TEXT,
    logros_adicionales TEXT,

    -- Historial académico adjunto (constancias de término/avance), guardado en la propia base de datos
    historial_pdf BYTEA,
    historial_pdf_nombre TEXT
  )`,

  // Migraciones para proyectos que ya tenían la tabla creada antes de estos campos.
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'termino'`,
  `ALTER TABLE constancias DROP CONSTRAINT IF EXISTS constancias_tipo_check`,
  `ALTER TABLE constancias ADD CONSTRAINT constancias_tipo_check CHECK (tipo IN ('termino', 'avance', 'docente', 'servicio_social'))`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS titulo_docente TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS cargo_docente TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS materias_titular TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS materias_impartidas TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS fecha_desde TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS texto_destacado TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS logros_adicionales TEXT`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS historial_pdf BYTEA`,
  `ALTER TABLE constancias ADD COLUMN IF NOT EXISTS historial_pdf_nombre TEXT`,
  // matricula y programa ya no son obligatorios (las constancias de docente no los usan).
  `ALTER TABLE constancias ALTER COLUMN matricula DROP NOT NULL`,
  `ALTER TABLE constancias ALTER COLUMN programa DROP NOT NULL`,


  `CREATE TABLE IF NOT EXISTS verificaciones_log (
    id SERIAL PRIMARY KEY,
    constancia_id INTEGER,
    token_consultado TEXT NOT NULL,
    encontrada BOOLEAN NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip TEXT
  )`
];
