import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'data/steamlab.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'draft',
    ai_chat_url  TEXT NOT NULL DEFAULT '',
    teacher_note TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS iterations (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'initial',
    status          TEXT NOT NULL DEFAULT 'copied',
    fields_json     TEXT NOT NULL DEFAULT '{}',
    prompt_readable TEXT NOT NULL DEFAULT '',
    prompt_full     TEXT NOT NULL DEFAULT '',
    code_html       TEXT NOT NULL DEFAULT '',
    code_css        TEXT NOT NULL DEFAULT '',
    code_js         TEXT NOT NULL DEFAULT '',
    code_document   TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    delivered_at    TEXT,
    UNIQUE (project_id, version)
  );

  CREATE INDEX IF NOT EXISTS idx_iterations_project ON iterations (project_id, version);
  CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects (updated_at DESC);
`)

/* ------------------------------------------------- taller de imagenes con IA
   Mismo ciclo que los juegos (pedido del alumno -> profe -> entrega -> mejora)
   pero lo que vuelve son 4 imagenes por pedido en vez de codigo. Tablas aparte
   para no mezclar los dos talleres. */

db.exec(`
  CREATE TABLE IF NOT EXISTS image_projects (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    student_name TEXT NOT NULL DEFAULT '',
    teacher_name TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'draft',
    ai_chat_url  TEXT NOT NULL DEFAULT '',
    teacher_note TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS image_requests (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES image_projects(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'initial',
    status          TEXT NOT NULL DEFAULT 'copied',
    prompt_text     TEXT NOT NULL DEFAULT '',
    prompt_readable TEXT NOT NULL DEFAULT '',
    prompt_full     TEXT NOT NULL DEFAULT '',
    base_asset_id   TEXT NOT NULL DEFAULT '',
    published_by    TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    delivered_at    TEXT,
    UNIQUE (project_id, version)
  );

  CREATE TABLE IF NOT EXISTS image_assets (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES image_projects(id) ON DELETE CASCADE,
    request_id   TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'reference',
    position     INTEGER NOT NULL DEFAULT 0,
    filename     TEXT NOT NULL DEFAULT '',
    mime         TEXT NOT NULL DEFAULT 'image/png',
    bytes        INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_image_requests_project ON image_requests (project_id, version);
  CREATE INDEX IF NOT EXISTS idx_image_assets_request ON image_assets (request_id, role, position);
  CREATE INDEX IF NOT EXISTS idx_image_projects_updated ON image_projects (updated_at DESC);
`)

/* ------------------------------------------- generacion automatica con IA
   Cada iteracion puede tener varios intentos de la IA. Un intento es un borrador privado:
   nunca forma parte del detalle del proyecto, la galeria ni /play. Solo se publica al aprobarlo. */

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_attempts (
    id            TEXT PRIMARY KEY,
    iteration_id  TEXT NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
    seq           INTEGER NOT NULL,
    feedback      TEXT NOT NULL DEFAULT '',
    requested_by  TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'queued',
    code_html     TEXT NOT NULL DEFAULT '',
    base_code     TEXT NOT NULL DEFAULT '',
    error         TEXT NOT NULL DEFAULT '',
    error_code    TEXT NOT NULL DEFAULT '',
    warning       TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    tries         INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    started_at    TEXT,
    finished_at   TEXT,
    UNIQUE (iteration_id, seq)
  );

  CREATE INDEX IF NOT EXISTS idx_ai_attempts_status ON ai_attempts (status);
  CREATE INDEX IF NOT EXISTS idx_ai_attempts_created ON ai_attempts (created_at);
`)

export function newId() {
  return crypto.randomBytes(9).toString('base64url')
}

export function now() {
  return new Date().toISOString()
}

/* ---------------------------------------------------------- migraciones */

function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
}

function addColumn(table, name, definition) {
  if (!columns(table).includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
}

// Quien del equipo de profes tomo el proyecto.
addColumn('projects', 'teacher_name', "TEXT NOT NULL DEFAULT ''")
// Quien cargo el codigo de cada version: 'teacher' o 'student'.
addColumn('iterations', 'published_by', "TEXT NOT NULL DEFAULT ''")
