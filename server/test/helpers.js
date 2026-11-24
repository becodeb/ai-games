import { createApp } from '../src/app.js'

export async function startServer() {
  const { server, io } = createApp()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api`

  async function call(method, url, body) {
    const response = await fetch(base + url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* no era JSON */
    }
    return { status: response.status, json, text }
  }

  return {
    base,
    call,
    get: (url) => call('GET', url),
    post: (url, body = {}) => call('POST', url, body),
    put: (url, body) => call('PUT', url, body),
    close: () => new Promise((resolve) => { io.close(); server.close(() => resolve()); server.closeAllConnections?.() })
  }
}

export async function waitFor(check, { timeout = 8000, step = 20 } = {}) {
  const end = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error('waitFor: se acabo el tiempo')
    await new Promise((resolve) => setTimeout(resolve, step))
  }
}

export const FULL_DOC = (marker) => `<!DOCTYPE html><html><head><title>x</title></head><body>${marker}</body></html>`
