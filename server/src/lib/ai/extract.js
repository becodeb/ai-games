/**
 * Respuesta de la IA -> documento HTML. Acepta un bloque ```html o el documento pelado.
 * Los <script> inline se compilan con node:vm SIN ejecutarlos: si hay un error de sintaxis el
 * borrador igual se guarda, con un aviso para que el profe pida rehacerlo.
 */
import vm from 'node:vm'

export class ExtractError extends Error {}

const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript'])

function unfence(text) {
  const open = text.match(/```[ \t]*(?:html)?[ \t]*\r?\n/i)
  if (!open) return text
  const start = open.index + open[0].length
  // El cierre es el ultimo ``` del texto: el codigo puede tener ``` adentro (p. ej. en un template string).
  const end = text.lastIndexOf('```')
  return end > start ? text.slice(start, end) : text.slice(start)
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*(?:=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'i'))
  if (!m) return null
  return m[1] ?? m[2] ?? m[3] ?? ''
}

/** Devuelve el texto del primer error de sintaxis de los scripts inline, o ''. */
export function findSyntaxError(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  let index = 0
  let match
  while ((match = re.exec(html))) {
    index += 1
    const attrs = match[1]
    if (attr(attrs, 'src') !== null) continue
    const type = (attr(attrs, 'type') ?? '').trim().toLowerCase()
    if (!JS_TYPES.has(type)) continue // module, json, importmap...
    const source = match[2]
    if (!source.trim()) continue
    try {
      new vm.Script(source, { filename: `script-${index}` })
    } catch (error) {
      const line = String(error.stack || '').match(/script-\d+:(\d+)/)?.[1]
      const where = line ? ` (script ${index}, linea ${line})` : ` (script ${index})`
      return `El codigo tiene un error de sintaxis: ${error.message}${where}`
    }
  }
  return ''
}

/** @returns {{html: string, warning: string}} */
export function extractGame(text) {
  const raw = String(text ?? '')
  let body = unfence(raw).trim()

  const doctype = body.search(/<!doctype\s+html/i)
  const htmlTag = body.search(/<html[\s>]/i)
  const first = [doctype, htmlTag].filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (first === undefined) throw new ExtractError('La IA no devolvio un juego en HTML. Proba de nuevo o pedile cambios.')
  body = body.slice(first)

  const close = body.search(/<\/html\s*>/i)
  if (close < 0) throw new ExtractError('La respuesta de la IA vino incompleta (falta el final del HTML). Proba de nuevo.')
  body = body.slice(0, body.indexOf('>', close) + 1)

  return { html: body, warning: findSyntaxError(body) }
}
