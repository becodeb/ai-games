import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractGame, ExtractError, findSyntaxError } from '../src/lib/ai/extract.js'
import { buildUserMessage, joinCode } from '../src/lib/ai/prompt.js'

const DOC = '<!DOCTYPE html><html><head><title>t</title></head><body><script>let a = 1; a++</script></body></html>'

describe('extractGame', () => {
  it('acepta un bloque ```html con texto alrededor', () => {
    const { html, warning } = extractGame(`Aca va:\n\`\`\`html\n${DOC}\n\`\`\`\nListo!`)
    assert.equal(html, DOC)
    assert.equal(warning, '')
  })

  it('acepta el documento pelado y recorta lo que sobra', () => {
    assert.equal(extractGame(`  ${DOC}\n\nChau`).html, DOC)
    assert.equal(extractGame('<html><body>hola</body></html>').html, '<html><body>hola</body></html>')
  })

  it('un ``` dentro del codigo no corta el documento', () => {
    const doc = '<!DOCTYPE html><html><body><script>const s = `a```b`;</script></body></html>'
    assert.equal(extractGame('```html\n' + doc + '\n```').html, doc)
  })

  it('rechaza lo que no es un documento completo', () => {
    assert.throws(() => extractGame('Lo siento, no puedo.'), ExtractError)
    assert.throws(() => extractGame('```html\n<!DOCTYPE html><html><body>cortado'), /incompleta/)
    assert.throws(() => extractGame(''), ExtractError)
  })

  it('un error de sintaxis no tira el borrador: lo devuelve con aviso', () => {
    const bad = '<!DOCTYPE html><html><body><script>function(){</script></body></html>'
    const { html, warning } = extractGame(bad)
    assert.equal(html, bad)
    assert.match(warning, /^El codigo tiene un error de sintaxis: .+\(script 1, linea 1\)$/)
  })
})

describe('findSyntaxError', () => {
  it('solo compila los scripts de JS clasico inline', () => {
    const page = (scripts) => `<!DOCTYPE html><html><body>${scripts}</body></html>`
    assert.equal(findSyntaxError(page('<script type="module">import x from "./a.js"; await 1</script>')), '')
    assert.equal(findSyntaxError(page('<script type="application/json">{"a": }</script>')), '')
    assert.equal(findSyntaxError(page('<script type="importmap">{ no json</script>')), '')
    assert.equal(findSyntaxError(page('<script src="x.js">esto = no se mira</script>')), '')
    assert.equal(findSyntaxError(page('<script></script>')), '')
    assert.equal(findSyntaxError(page('<script type="text/javascript">var ok = 1</script>')), '')
    assert.match(findSyntaxError(page('<script>var ok = 1</script><script>let = = 2</script>')), /script 2/)
  })

  it('compilar no ejecuta nada', () => {
    globalThis.__ejecutado = false
    assert.equal(findSyntaxError('<script>globalThis.__ejecutado = true</script>'), '')
    assert.equal(globalThis.__ejecutado, false)
  })
})

describe('prompt', () => {
  it('joinCode une css y js al documento sin inyectar el runtime', () => {
    const doc = joinCode({ html: '<!DOCTYPE html><html><head></head><body><p>x</p></body></html>', css: 'p{color:red}', js: 'var s = "</script>"' })
    assert.match(doc, /<style>\np\{color:red\}\n<\/style>\n<\/head>/)
    assert.match(doc, /<script>\nvar s = "<\\\/script>"\n<\/script>\n<\/body>/)
    assert.doesNotMatch(doc, /steamlab/)
    assert.equal(joinCode({ html: ' <p>solo</p> ' }), '<p>solo</p>')
    assert.match(joinCode({ html: '<p>frag</p>', js: 'a()' }), /^<!DOCTYPE html>[\s\S]*<p>frag<\/p>[\s\S]*<script>/)
  })

  it('el pedido nuevo va despues del contexto y el codigo se manda entero', () => {
    const big = 'x'.repeat(50_000)
    const message = buildUserMessage({
      iteration: { promptReadable: 'nuevo', promptFull: 'full' },
      earlier: [{ version: 1, promptReadable: 'viejo', promptFull: 'f' }],
      previousCode: { version: 1, code: big },
      baseCode: big + 'Y',
      previousFeedback: ['CAMBIO-UNO'],
      feedback: 'CAMBIO-DOS'
    })
    assert.ok(message.includes(big + 'Y') && message.includes(`>\n${big}\n</codigo>`)) // sin recortes
    assert.ok(message.indexOf('viejo') < message.indexOf('nuevo'))
    assert.ok(message.indexOf('CAMBIO-UNO') < message.indexOf('CAMBIO-DOS'))
  })
})
