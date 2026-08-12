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

  // Alumno
  listProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: data }),
  getProject: (id) => request(`/projects/${id}`),
  addIteration: (id, data) => request(`/projects/${id}/iterations`, { method: 'POST', body: data }),

  // Profesor
  listDashboard: () => request('/dashboard'),
  getDashboardProject: (id) => request(`/dashboard/${id}`),
  patchProject: (id, data) => request(`/dashboard/${id}`, { method: 'PATCH', body: data }),
  saveIterationCode: (iterationId, code) => request(`/iterations/${iterationId}/code`, { method: 'PUT', body: code }),
  // Devuelve exactamente el documento que veria el alumno, sin guardar nada.
  preview: (code) => request('/preview', { method: 'POST', body: code }),

  // Galeria
  listGallery: () => request('/gallery')
}

export const playUrl = (iterationId) => `${BASE}/iterations/${iterationId}/play`
export const downloadUrl = (iterationId) => `${BASE}/iterations/${iterationId}/download`
