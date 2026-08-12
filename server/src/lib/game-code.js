/**
 * Union de lo que el profesor pega (documento unico, o bloques HTML/CSS/JS sueltos)
 * en un unico documento HTML autonomo, listo para correr dentro de un iframe sandbox.
 */

const RUNTIME_PRELUDE = `<script data-steamlab="runtime">
(function () {
  // El iframe corre en un origen opaco (sandbox sin allow-same-origin), asi que
  // localStorage/sessionStorage lanzan SecurityError. Muchos juegos generados por IA
  // los usan para el puntaje maximo: les damos un reemplazo en memoria.
  function shim() {
    var store = Object.create(null);
    return {
      getItem: function (k) { k = String(k); return k in store ? store[k] : null; },
      setItem: function (k, v) { store[String(k)] = String(v); },
      removeItem: function (k) { delete store[String(k)]; },
      clear: function () { store = Object.create(null); },
      key: function (i) { var ks = Object.keys(store); return i < ks.length ? ks[i] : null; },
      get length() { return Object.keys(store).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    var ok = false;
    try {
      window[name].setItem('__steamlab__', '1');
      window[name].removeItem('__steamlab__');
      ok = true;
    } catch (e) { ok = false; }
    if (!ok) {
      try { Object.defineProperty(window, name, { value: shim(), configurable: true }); } catch (e) {}
    }
  });

  // Reportamos errores al contenedor para que profe y alumno los vean sin abrir devtools.
  function report(message, source, line) {
    try {
      parent.postMessage({
        __steamlab: true,
        type: 'game-error',
        message: String(message || 'Error desconocido'),
        source: source ? String(source) : '',
        line: typeof line === 'number' ? line : null
      }, '*');
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    report(e && e.message, e && e.filename, e && e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    report(r && r.message ? r.message : r, '', null);
  });
  var nativeError = console.error;
  console.error = function () {
    report(Array.prototype.map.call(arguments, function (a) {
      if (a instanceof Error) return a.message;
      if (a && typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).join(' '), '', null);
    return nativeError.apply(console, arguments);
  };

  // Aviso al contenedor de que el juego arranco (sirve para el indicador de carga).
  window.addEventListener('load', function () {
    try { parent.postMessage({ __steamlab: true, type: 'game-ready' }, '*'); } catch (e) {}
  });
})();
</script>`

const BASE_STYLE = `<style data-steamlab="base">
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
  body { background: #ffffff; }
</style>`

/** Evita que un `</script>` dentro del codigo pegado corte el bloque inyectado. */
function safeScript(js) {
  return String(js).replace(/<\/(script)/gi, '<\\/$1')
}

function isFullDocument(html) {
  return /<html[\s>]/i.test(html) || /<!doctype\s+html/i.test(html)
}

function injectBefore(doc, tagRegex, snippet) {
  if (!snippet) return doc
  const match = doc.match(tagRegex)
  if (!match) return null
  return doc.slice(0, match.index) + snippet + '\n' + doc.slice(match.index)
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{html?: string, css?: string, js?: string, title?: string}} parts
 * @returns {string} documento HTML completo y autonomo
 */
export function buildGameDocument(parts = {}) {
  const html = (parts.html || '').trim()
  const css = (parts.css || '').trim()
  const js = (parts.js || '').trim()
  const title = (parts.title || '').trim() || 'Juego'

  const cssBlock = css ? `<style data-steamlab="custom">\n${css}\n</style>` : ''
  const jsBlock = js ? `<script data-steamlab="custom">\n${safeScript(js)}\n</script>` : ''
  const headBlock = [RUNTIME_PRELUDE, BASE_STYLE, cssBlock].filter(Boolean).join('\n')

  if (html && isFullDocument(html)) {
    let doc = html

    const withHead = injectBefore(doc, /<\/head\s*>/i, headBlock)
    if (withHead) {
      doc = withHead
    } else {
      const beforeBody = injectBefore(doc, /<body[\s>]/i, headBlock)
      doc = beforeBody || `${headBlock}\n${doc}`
    }

    if (jsBlock) {
      const withJs = injectBefore(doc, /<\/body\s*>/i, jsBlock)
      doc = withJs || `${doc}\n${jsBlock}`
    }
    return doc
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${headBlock}
</head>
<body>
${html}
${jsBlock}
</body>
</html>`
}

export function hasPlayableCode(parts = {}) {
  return Boolean((parts.html || '').trim() || (parts.js || '').trim() || (parts.css || '').trim())
}
