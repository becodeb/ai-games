import { db, newId, now } from '../db.js'
import { decodeDataUrl, removeImage, writeImage } from './image-files.js'

/** Estados de proyecto: draft | pending | processing | completed */
/** Estados de pedido:   copied | pending | delivered */

const MAX_TEXT = 20_000
/** Cuantas imagenes devuelve el profe por cada pedido. */
export const RESULTS_PER_REQUEST = 4
/** Cuantas referencias puede adjuntar el alumno. */
export const MAX_REFERENCES = 4

function clean(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return ''
  return String(value).slice(0, max)
}

/* ------------------------------------------------------------------ mapeo */

function mapAsset(row) {
  return {
    id: row.id,
    role: row.role,
    position: row.position,
    filename: row.filename,
    mime: row.mime,
    bytes: row.bytes,
    url: `/api/images/file/${row.id}`,
    createdAt: row.created_at
  }
}

function mapRequest(row, assets) {
  const mine = assets.filter((asset) => asset.request_id === row.id)
  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    kind: row.kind,
    status: row.status,
    promptText: row.prompt_text,
    promptReadable: row.prompt_readable,
    promptFull: row.prompt_full,
    baseAssetId: row.base_asset_id || '',
    publishedBy: row.published_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
    references: mine.filter((asset) => asset.role === 'reference').map(mapAsset),
    results: mine.filter((asset) => asset.role === 'result').map(mapAsset),
    hasResults: mine.some((asset) => asset.role === 'result')
  }
}

function mapProject(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    studentName: row.student_name,
    teacherName: row.teacher_name || '',
    status: row.status,
    aiChatUrl: row.ai_chat_url,
    teacherNote: row.teacher_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/* ------------------------------------------------------------ statements */

const statements = {
  insertProject: db.prepare(`
    INSERT INTO image_projects (id, title, student_name, teacher_name, status, ai_chat_url, teacher_note, created_at, updated_at)
    VALUES (@id, @title, @student_name, '', 'draft', '', '', @created_at, @updated_at)
  `),
  getProject: db.prepare('SELECT * FROM image_projects WHERE id = ?'),
  listProjects: db.prepare('SELECT * FROM image_projects ORDER BY updated_at DESC'),

  insertRequest: db.prepare(`
    INSERT INTO image_requests (
      id, project_id, version, kind, status, prompt_text, prompt_readable, prompt_full,
      base_asset_id, published_by, created_at, updated_at, delivered_at
    ) VALUES (
      @id, @project_id, @version, @kind, @status, @prompt_text, @prompt_readable, @prompt_full,
      @base_asset_id, '', @created_at, @updated_at, NULL
    )
  `),
  getRequest: db.prepare('SELECT * FROM image_requests WHERE id = ?'),
  listRequests: db.prepare('SELECT * FROM image_requests WHERE project_id = ? ORDER BY version ASC'),
  nextVersion: db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS next FROM image_requests WHERE project_id = ?'),
  countPending: db.prepare("SELECT COUNT(*) AS n FROM image_requests WHERE project_id = ? AND status = 'pending'"),
  countDelivered: db.prepare("SELECT COUNT(*) AS n FROM image_requests WHERE project_id = ? AND status = 'delivered'"),

  insertAsset: db.prepare(`
    INSERT INTO image_assets (id, project_id, request_id, role, position, filename, mime, bytes, storage_path, created_at)
    VALUES (@id, @project_id, @request_id, @role, @position, @filename, @mime, @bytes, @storage_path, @created_at)
  `),
  getAsset: db.prepare('SELECT * FROM image_assets WHERE id = ?'),
  listAssetsByProject: db.prepare('SELECT * FROM image_assets WHERE project_id = ? ORDER BY position ASC, created_at ASC'),
  listResults: db.prepare("SELECT * FROM image_assets WHERE request_id = ? AND role = 'result' ORDER BY position ASC")
}

/* ------------------------------------------------------------- adjuntos */

/**
 * Guarda en disco una lista de data URLs y las registra como assets del pedido.
 * Las que no son imagenes validas se ignoran en silencio: mejor entregar 3 que fallar.
 */
function saveAssets(list, { projectId, requestId, role, limit }) {
  const items = Array.isArray(list) ? list.slice(0, limit) : []
  const timestamp = now()
  let position = 0

  for (const item of items) {
    const source = typeof item === 'string' ? { dataUrl: item } : item || {}
    const decoded = decodeDataUrl(source.dataUrl)
    if (!decoded) continue

    const stored = writeImage(decoded)
    statements.insertAsset.run({
      id: stored.id,
      project_id: projectId,
      request_id: requestId,
      role,
      position: position++,
      filename: clean(source.name, 200),
      mime: decoded.mime,
      bytes: stored.bytes,
      storage_path: stored.filename,
      created_at: timestamp
    })
  }
  return position
}

/* -------------------------------------------------------------- lecturas */

export function getImageProject(id) {
  return mapProject(statements.getProject.get(id))
}

export function getImageProjectDetail(id) {
  const project = getImageProject(id)
  if (!project) return null
  const assets = statements.listAssetsByProject.all(id)
  const requests = statements.listRequests.all(id).map((row) => mapRequest(row, assets))
  return { project, requests }
}

export function getAssetRow(assetId) {
  return statements.getAsset.get(assetId)
}

/* ------------------------------------------------------------- escrituras */

function recomputeStatus(projectId) {
  const project = statements.getProject.get(projectId)
  if (!project) return

  const pending = statements.countPending.get(projectId).n
  const delivered = statements.countDelivered.get(projectId).n

  let status
  if (pending > 0) status = 'pending'
  else if (delivered > 0) status = 'completed'
  else status = 'draft'

  // "processing" lo marca un profe al tomar el proyecto y vale mientras haya algo pendiente.
  if (project.status === 'processing' && pending > 0) status = 'processing'

  db.prepare('UPDATE image_projects SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), projectId)
}

/** Crea el proyecto con su primer pedido (version 1). */
export function createImageProject(input) {
  const timestamp = now()
  const id = newId()
  const requestId = newId()
  const title = clean(input.title, 200).trim() || 'Imagen sin titulo'

  const tx = db.transaction(() => {
    statements.insertProject.run({
      id,
      title,
      student_name: clean(input.studentName, 160).trim(),
      created_at: timestamp,
      updated_at: timestamp
    })
    statements.insertRequest.run({
      id: requestId,
      project_id: id,
      version: 1,
      kind: 'initial',
      status: input.send ? 'pending' : 'copied',
      prompt_text: clean(input.promptText),
      prompt_readable: clean(input.promptReadable),
      prompt_full: clean(input.promptFull),
      base_asset_id: '',
      created_at: timestamp,
      updated_at: timestamp
    })
  })
  tx()

  saveAssets(input.references, { projectId: id, requestId, role: 'reference', limit: MAX_REFERENCES })

  recomputeStatus(id)
  return getImageProjectDetail(id)
}

/** Agrega un pedido nuevo (version N+1) sin tocar los anteriores. */
export function addImageRequest(projectId, input) {
  const project = statements.getProject.get(projectId)
  if (!project) return null

  const timestamp = now()
  const requestId = newId()
  const version = statements.nextVersion.get(projectId).next

  // La imagen elegida como base tiene que ser un resultado de este mismo proyecto.
  const base = input.baseAssetId ? statements.getAsset.get(input.baseAssetId) : null
  const baseAssetId = base && base.project_id === projectId && base.role === 'result' ? base.id : ''

  statements.insertRequest.run({
    id: requestId,
    project_id: projectId,
    version,
    kind: 'iteration',
    status: input.send ? 'pending' : 'copied',
    prompt_text: clean(input.promptText),
    prompt_readable: clean(input.promptReadable),
    prompt_full: clean(input.promptFull),
    base_asset_id: baseAssetId,
    created_at: timestamp,
    updated_at: timestamp
  })

  saveAssets(input.references, { projectId, requestId, role: 'reference', limit: MAX_REFERENCES })

  recomputeStatus(projectId)
  return getImageProjectDetail(projectId)
}

/** "Ya lo copie pero igual lo quiero mandar": no crea una version nueva. */
export function markRequestSent(requestId) {
  const row = statements.getRequest.get(requestId)
  if (!row) return null
  if (row.status === 'copied') {
    db.prepare("UPDATE image_requests SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), requestId)
    recomputeStatus(row.project_id)
  }
  return row.project_id
}

/**
 * El profe entrega (o corrige) las imagenes de un pedido.
 * Reemplaza la tanda anterior completa: lo que ve el alumno es siempre la ultima entrega.
 */
export function saveRequestResults(requestId, input) {
  const row = statements.getRequest.get(requestId)
  if (!row) return null

  const previous = statements.listResults.all(requestId)
  const timestamp = now()

  const saved = saveAssets(input.results, {
    projectId: row.project_id,
    requestId,
    role: 'result',
    limit: RESULTS_PER_REQUEST
  })
  // Si ninguna imagen era valida no tocamos nada: el pedido sigue pendiente.
  if (!saved) return { projectId: row.project_id, saved: 0 }

  // Recien cuando la tanda nueva quedo guardada borramos la vieja.
  if (previous.length) {
    const ids = previous.map((asset) => asset.id)
    db.prepare(`DELETE FROM image_assets WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids)
    previous.forEach((asset) => removeImage(asset.storage_path))
  }

  db.prepare(`
    UPDATE image_requests
    SET status = 'delivered', published_by = ?, updated_at = ?, delivered_at = ?
    WHERE id = ?
  `).run(
    clean(input.publishedBy, 80) || row.published_by || 'teacher',
    timestamp,
    row.delivered_at || timestamp,
    requestId
  )

  // Entregado: el proyecto queda libre para el proximo profe.
  db.prepare('UPDATE image_projects SET teacher_name = ?, updated_at = ? WHERE id = ?').run('', timestamp, row.project_id)
  recomputeStatus(row.project_id)

  return { projectId: row.project_id, saved }
}

export function updateImageProject(projectId, patch) {
  const project = statements.getProject.get(projectId)
  if (!project) return null

  const fields = []
  const values = []

  if (patch.title !== undefined) {
    fields.push('title = ?')
    values.push(clean(patch.title, 200).trim() || project.title)
  }
  if (patch.studentName !== undefined) {
    fields.push('student_name = ?')
    values.push(clean(patch.studentName, 160).trim())
  }
  if (patch.teacherName !== undefined) {
    fields.push('teacher_name = ?')
    values.push(clean(patch.teacherName, 80).trim())
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
    db.prepare(`UPDATE image_projects SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  return projectId
}

/* --------------------------------------------------------------- listados */

/** Listado para el dashboard de imagenes. */
export function listImageDashboard() {
  return statements.listProjects.all().map((row) => {
    const requests = statements.listRequests.all(row.id)
    const pending = requests.filter((request) => request.status === 'pending')
    const delivered = requests.filter((request) => request.status === 'delivered')
    const last = requests[requests.length - 1]
    const lastDelivered = delivered[delivered.length - 1]
    const cover = lastDelivered ? statements.listResults.all(lastDelivered.id)[0] : null

    return {
      ...mapProject(row),
      totalRequests: requests.length,
      currentVersion: last ? last.version : 0,
      deliveredCount: delivered.length,
      pendingVersion: pending.length ? pending[0].version : null,
      lastMaker: lastDelivered ? lastDelivered.published_by || '' : '',
      lastPromptPreview: (last?.prompt_readable || '').slice(0, 240),
      coverUrl: cover ? `/api/images/file/${cover.id}` : ''
    }
  })
}

/** Listado liviano para que el alumno recupere su sesion. */
export function listImageProjectsForStudents() {
  return statements.listProjects.all().map((row) => {
    const requests = statements.listRequests.all(row.id)
    return {
      id: row.id,
      title: row.title,
      studentName: row.student_name,
      status: row.status,
      currentVersion: requests.length ? requests[requests.length - 1].version : 0,
      updatedAt: row.updated_at
    }
  })
}

/** Proyectos con al menos una tanda entregada, para la galeria publica. */
export function listImageGallery() {
  const gallery = []

  for (const row of statements.listProjects.all()) {
    const delivered = statements.listRequests.all(row.id).filter((request) => request.status === 'delivered')
    const last = delivered[delivered.length - 1]
    if (!last) continue

    const results = statements.listResults.all(last.id)
    if (!results.length) continue

    gallery.push({
      projectId: row.id,
      requestId: last.id,
      title: row.title,
      studentName: row.student_name,
      version: last.version,
      versionCount: delivered.length,
      prompt: last.prompt_readable,
      images: results.map(mapAsset),
      updatedAt: last.updated_at || last.created_at
    })
  }

  return gallery.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}
