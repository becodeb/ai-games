/**
 * Falso servidor de la API de Anthropic (streaming SSE) para tests y para probar a mano sin gastar:
 *
 *   node server/test/fake-anthropic.js 4010
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=fake npm run dev:server
 *
 * Devuelve un juego de canvas chico y valido cuyo titulo lleva un contador de pedidos y, si el pedido
 * trae "cambios nuevos" (<cambio_nuevo>), tambien ese texto. Tarda `delayMs` (3 s por defecto suelto).
 * Modos: game | refusal | max_tokens | syntax | broken | auth | rate_limit | server_error
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function gameHtml({ counter, feedback = '', brokenScript = false }) {
  const title = `Juego falso #${counter}${feedback ? ` - ${feedback}` : ''}`
  const script = brokenScript
    ? 'var x = ;'
    : `
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let score = 0, t = 0;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
canvas.addEventListener('pointerdown', () => { score += 1; });
function loop() {
  t += 0.03;
  ctx.fillStyle = '#12304a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(canvas.width / 2 + Math.cos(t) * 80, canvas.height / 2 + Math.sin(t) * 80, 28, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif';
  ctx.fillText(${JSON.stringify(title).replace(/</g, '\\u003c')}, 16, 34);
  ctx.fillText('Puntos: ' + score, 16, 66);
  requestAnimationFrame(loop);
}
loop();`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>html,body{margin:0;height:100%}canvas{display:block}</style></head>
<body><canvas id="c"></canvas>
<script>${script}</script>
</body></html>`
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * @param {{delayMs?: number, mode?: string}} options
 * @returns {{url: string, requests: object[], aborted: number, mode: string, delayMs: number, listen: (port?: number) => Promise<object>, close: () => Promise<void>}}
 */
export function createFakeAnthropic({ delayMs = 0, mode = 'game' } = {}) {
  const fake = { url: '', requests: [], aborted: 0, mode, delayMs, counter: 0, listen: null, close: null }

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'no existe' } }))
    }

    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let body = {}
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        /* cuerpo invalido: se registra vacio */
      }
      fake.counter += 1
      const counter = fake.counter
      fake.requests.push({ body, headers: req.headers, url: req.url })

      const errorStatus = { auth: 401, rate_limit: 429, server_error: 500 }[fake.mode]
      if (errorStatus) {
        const type = { 401: 'authentication_error', 429: 'rate_limit_error', 500: 'api_error' }[errorStatus]
        res.writeHead(errorStatus, { 'content-type': 'application/json', 'x-should-retry': 'false' })
        return res.end(JSON.stringify({ type: 'error', error: { type, message: 'SECRETO-del-servidor' } }))
      }

      const last = body.messages?.at(-1)?.content
      const userText = typeof last === 'string' ? last : JSON.stringify(last ?? '')
      const feedback = (userText.match(/<cambio_nuevo>\n([\s\S]*?)\n<\/cambio_nuevo>/) || [])[1] || ''

      let timer = null
      let finished = false
      res.on('close', () => {
        if (!finished) {
          fake.aborted += 1
          clearTimeout(timer)
        }
      })

      timer = setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
        const refusal = fake.mode === 'refusal'
        sse(res, 'message_start', {
          type: 'message_start',
          message: {
            id: `msg_fake_${counter}`,
            type: 'message',
            role: 'assistant',
            model: body.model || 'claude-opus-5-5',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 1200, output_tokens: 1 }
          }
        })

        let text = ''
        if (!refusal) {
          const html = fake.mode === 'broken'
            ? '<!DOCTYPE html><html><body>Esto se corto'
            : gameHtml({ counter, feedback, brokenScript: fake.mode === 'syntax' })
          text = '```html\n' + html + '\n```'
          sse(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
          const mid = Math.floor(text.length / 2)
          for (const piece of [text.slice(0, mid), text.slice(mid)]) {
            sse(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })
          }
          sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
        }

        const stop = refusal ? 'refusal' : fake.mode === 'max_tokens' ? 'max_tokens' : 'end_turn'
        sse(res, 'message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stop, stop_sequence: null, ...(refusal ? { stop_details: { type: 'refusal', category: 'general_harms' } } : {}) },
          usage: { output_tokens: refusal ? 0 : 3400 }
        })
        sse(res, 'message_stop', { type: 'message_stop' })
        finished = true
        res.end()
      }, fake.delayMs)
    })
  })

  fake.listen = (port = 0) =>
    new Promise((resolve) => {
      server.listen(port, '127.0.0.1', () => {
        fake.url = `http://127.0.0.1:${server.address().port}`
        resolve(fake)
      })
    })
  fake.close = () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()) })
  return fake
}

export async function startFakeAnthropic(options = {}) {
  const fake = createFakeAnthropic(options)
  await fake.listen(options.port ?? 0)
  return fake
}

// Uso suelto: node server/test/fake-anthropic.js 4010 [delayMs] [mode]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || 4010)
  const delayMs = Number(process.argv[3] ?? 3000)
  const mode = process.argv[4] || 'game'
  // Sin top-level await: este modulo lo importan los tests y debe evaluarse de forma sincrona.
  startFakeAnthropic({ port, delayMs, mode }).then((fake) => {
    console.log(`[fake-anthropic] escuchando en ${fake.url} (demora ${delayMs} ms, modo ${mode})`)
  })
}
