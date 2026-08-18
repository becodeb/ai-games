const BASE = '/api'

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })

  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    throw new Error(payload?.error || `Error ${response.status}`)
  }
  return payload
}

export const api = {
  health: () => request('/health'),

  // Proyectos
  listProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  getProject: (id) => request(`/projects/${id}`),
  patchProject: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: data }),

  // Iteraciones
  addIteration: (id, data) => request(`/projects/${id}/iterations`, { method: 'POST', body: data }),
  sendIteration: (iterationId) => request(`/iterations/${iterationId}/send`, { method: 'POST', body: {} }),
  saveIterationCode: (iterationId, code) => request(`/iterations/${iterationId}/code`, { method: 'PUT', body: code }),

  // Devuelve exactamente el documento que se va a publicar, sin guardar nada.
  preview: (code) => request('/preview', { method: 'POST', body: code }),

  // Profesor y galeria
  listDashboard: () => request('/dashboard'),
  listGallery: () => request('/gallery')
}

export const playUrl = (iterationId) => `${BASE}/iterations/${iterationId}/play`
export const downloadUrl = (iterationId) => `${BASE}/iterations/${iterationId}/download`
