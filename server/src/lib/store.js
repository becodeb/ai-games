import { db, newId, now } from '../db.js'
import { buildGameDocument, hasPlayableCode } from './game-code.js'

/** Estados de proyecto: draft | pending | processing | completed */
/** Estados de iteracion: copied | pending | delivered */

const MAX_TEXT = 400_000

function clean(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return ''
  return String(value).slice(0, max)
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapIteration(row, { includeCode = true } = {}) {
  if (!row) return null
  const base = {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    kind: row.kind,
    status: row.status,
    fields: parseJson(row.fields_json, {}),
    promptReadable: row.prompt_readable,
    promptFull: row.prompt_full,
    hasCode: Boolean(row.code_document),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at
  }
  if (!includeCode) return base
  return {
    ...base,
    code: {
      html: row.code_html,
      css: row.code_css,
      js: row.code_js
    }
  }
}

function mapProject(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    studentName: row.student_name,
    status: row.status,
    aiChatUrl: row.ai_chat_url,
    teacherNote: row.teacher_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const statements = {
  insertProject: db.prepare(`
    INSERT INTO projects (id, title, student_name, status, ai_chat_url, teacher_note, created_at, updated_at)
    VALUES (@id, @title, @student_name, @status, '', '', @created_at, @updated_at)
  `),
  getProject: db.prepare('SELECT * FROM projects WHERE id = ?'),
  listProjects: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC'),
  touchProject: db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?'),
  insertIteration: db.prepare(`
    INSERT INTO iterations (
      id, project_id, version, kind, status, fields_json, prompt_readable, prompt_full,
      code_html, code_css, code_js, code_document, created_at, updated_at, delivered_at
    ) VALUES (
      @id, @project_id, @version, @kind, @status, @fields_json, @prompt_readable, @prompt_full,
      '', '', '', '', @created_at, @updated_at, NULL
    )
  `),
  getIteration: db.prepare('SELECT * FROM iterations WHERE id = ?'),
  listIterations: db.prepare('SELECT * FROM iterations WHERE project_id = ? ORDER BY version ASC'),
  nextVersion: db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM iterations WHERE project_id = ?'),
  countPending: db.prepare("SELECT COUNT(*) AS n FROM iterations WHERE project_id = ? AND status = 'pending'"),
  countDelivered: db.prepare("SELECT COUNT(*) AS n FROM iterations WHERE project_id = ? AND code_document <> ''"),
  latestDelivered: db.prepare(`
    SELECT * FROM iterations
    WHERE project_id = ? AND code_document <> ''
    ORDER BY version DESC LIMIT 1
  `)
}

export function getProject(id) {
  return mapProject(statements.getProject.get(id))
}

export function getIterationRow(id) {
  return statements.getIteration.get(id)
}

/**
 * @param {string} id
 * @param {{includeCode?: boolean}} options el codigo fuente solo viaja al dashboard del profesor
 */
export function getProjectDetail(id, { includeCode = false } = {}) {
  const project = getProject(id)
  if (!project) return null
  const iterations = statements.listIterations.all(id).map((row) => mapIteration(row, { includeCode }))
  return { project, iterations }
}

function recomputeStatus(projectId) {
  const project = statements.getProject.get(projectId)
  if (!project) return
  const pending = statements.countPending.get(projectId).n
  const delivered = statements.countDelivered.get(projectId).n

  let status
  if (pending > 0) status = 'pending'
  else if (delivered > 0) status = 'completed'
  else status = 'draft'

  // "processing" lo marca el profesor a mano y solo vale mientras haya algo pendiente.
  if (project.status === 'processing' && pending > 0) status = 'processing'

  db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), projectId)
}

/**
 * Crea el proyecto junto con su primera iteracion (version 1). Nunca sobreescribe nada.
 */
export function createProject(input) {
  const timestamp = now()
  const id = newId()
  const title = clean(input.title, 160).trim() || 'Juego sin titulo'
  const studentName = clean(input.studentName, 120).trim()
  const status = input.send ? 'pending' : 'copied'

  const tx = db.transaction(() => {
    statements.insertProject.run({
      id,
      title,
      student_name: studentName,
      status: 'draft',
      created_at: timestamp,
      updated_at: timestamp
    })
    statements.insertIteration.run({
      id: newId(),
      project_id: id,
      version: 1,
      kind: 'initial',
      status,
      fields_json: JSON.stringify(input.fields || {}),
      prompt_readable: clean(input.promptReadable),
      prompt_full: clean(input.promptFull),
      created_at: timestamp,
      updated_at: timestamp
    })
  })
  tx()
  recomputeStatus(id)
  return getProjectDetail(id)
}

/**
 * Agrega una iteracion nueva (version_N+1). Las anteriores quedan intactas.
 */
export function addIteration(projectId, input) {
  const project = statements.getProject.get(projectId)
  if (!project) return null

  const timestamp = now()
  const version = statements.nextVersion.get(projectId).next
  const status = input.send ? 'pending' : 'copied'

  statements.insertIteration.run({
    id: newId(),
    project_id: projectId,
    version,
    kind: 'iteration',
    status,
    fields_json: JSON.stringify(input.fields || {}),
    prompt_readable: clean(input.promptReadable),
    prompt_full: clean(input.promptFull),
    created_at: timestamp,
    updated_at: timestamp
  })

  recomputeStatus(projectId)
  return getProjectDetail(projectId)
}

export function updateProject(projectId, patch) {
  const project = statements.getProject.get(projectId)
  if (!project) return null

  const fields = []
  const values = []

  if (patch.title !== undefined) {
    fields.push('title = ?')
    values.push(clean(patch.title, 160).trim() || project.title)
  }
  if (patch.studentName !== undefined) {
    fields.push('student_name = ?')
    values.push(clean(patch.studentName, 120).trim())
  }
  if (patch.aiChatUrl !== undefined) {
    fields.push('ai_chat_url = ?')
    values.push(clean(patch.aiChatUrl, 2000).trim())
  }
  if (patch.teacherNote !== undefined) {
    fields.push('teacher_note = ?')
    values.push(clean(patch.teacherNote, 4000))
  }
  if (patch.status !== undefined && ['draft', 'pending', 'processing', 'completed'].includes(patch.status)) {
    fields.push('status = ?')
    values.push(patch.status)
  }

  if (fields.length) {
    fields.push('updated_at = ?')
    values.push(now(), projectId)
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  return projectId
}

/**
 * Guarda (o corrige retroactivamente) el codigo de una iteracion cualquiera.
 */
export function saveIterationCode(iterationId, parts) {
  const row = statements.getIteration.get(iterationId)
  if (!row) return null

  const project = statements.getProject.get(row.project_id)
  const html = clean(parts.html)
  const css = clean(parts.css)
  const js = clean(parts.js)
  const playable = hasPlayableCode({ html, css, js })
  const document = playable ? buildGameDocument({ html, css, js, title: project?.title }) : ''
  const timestamp = now()

  db.prepare(`
    UPDATE iterations
    SET code_html = ?, code_css = ?, code_js = ?, code_document = ?,
        status = ?, updated_at = ?, delivered_at = ?
    WHERE id = ?
  `).run(
    html,
    css,
    js,
    document,
    playable ? 'delivered' : row.status,
    timestamp,
    playable ? (row.delivered_at || timestamp) : row.delivered_at,
    iterationId
  )

  statements.touchProject.run(timestamp, row.project_id)
  recomputeStatus(row.project_id)
  return row.project_id
}

export function getIterationDocument(iterationId) {
  const row = statements.getIteration.get(iterationId)
  if (!row || !row.code_document) return null
  return row.code_document
}

/** Listado para el dashboard del profesor. */
export function listDashboard() {
  return statements.listProjects.all().map((row) => {
    const iterations = statements.listIterations.all(row.id)
    const pending = iterations.filter((it) => it.status === 'pending')
    const delivered = iterations.filter((it) => it.code_document)
    return {
      ...mapProject(row),
      totalIterations: iterations.length,
      currentVersion: iterations.length ? iterations[iterations.length - 1].version : 0,
      deliveredCount: delivered.length,
      pendingVersion: pending.length ? pending[0].version : null,
      lastPromptPreview: (iterations[iterations.length - 1]?.prompt_readable || '').slice(0, 240)
    }
  })
}

/** Listado liviano para que el alumno recupere su sesion. */
export function listProjectsForStudents() {
  return statements.listProjects.all().map((row) => {
    const iterations = statements.listIterations.all(row.id)
    return {
      id: row.id,
      title: row.title,
      studentName: row.student_name,
      status: row.status,
      currentVersion: iterations.length ? iterations[iterations.length - 1].version : 0,
      updatedAt: row.updated_at
    }
  })
}

/** Juegos con al menos una version jugable. */
export function listGallery() {
  const projects = statements.listProjects.all()
  const games = []
  for (const row of projects) {
    const latest = statements.latestDelivered.get(row.id)
    if (!latest) continue
    const delivered = statements.countDelivered.get(row.id).n
    games.push({
      projectId: row.id,
      iterationId: latest.id,
      title: row.title,
      studentName: row.student_name,
      version: latest.version,
      versionCount: delivered,
      updatedAt: latest.updated_at || latest.created_at
    })
  }
  return games.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}
