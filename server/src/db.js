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
