// Sentencias DDL para Postgres (Vercel Postgres / Neon).
// Se ejecutan una por una desde db/init.js
module.exports = [
  `CREATE TABLE IF NOT EXISTS empleados (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    puesto TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS constancias (
    id SERIAL PRIMARY KEY,
    folio TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    matricula TEXT NOT NULL,
    nombre TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    programa TEXT NOT NULL,
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
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS verificaciones_log (
    id SERIAL PRIMARY KEY,
    constancia_id INTEGER,
    token_consultado TEXT NOT NULL,
    encontrada BOOLEAN NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip TEXT
  )`
];
