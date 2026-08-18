/**
 * Texto para retomar el hilo con la IA cuando se corta la conversacion:
 * todo lo que se pidio hasta ahora + el codigo de la ultima version que anda.
 */

export function latestWithCode(iterations) {
  for (let i = iterations.length - 1; i >= 0; i -= 1) {
    if (iterations[i].hasCode) return iterations[i]
  }
  return null
}

export function previousWithCode(iterations, beforeVersion) {
  for (let i = iterations.length - 1; i >= 0; i -= 1) {
    if (iterations[i].hasCode && iterations[i].version < beforeVersion) return iterations[i]
  }
  return null
}

function codeOf(iteration) {
  if (!iteration) return ''
  const { html = '', css = '', js = '' } = iteration.code || {}
  if (css || js) {
    return [html && `<!-- HTML -->\n${html}`, css && `/* CSS */\n${css}`, js && `// JS\n${js}`]
      .filter(Boolean)
      .join('\n\n')
  }
  return html
}

/**
 * @param {{title: string, studentName?: string}} project
 * @param {Array} iterations
 * @param {{upToVersion?: number, includeCode?: boolean}} options
 */
export function buildRestartContext(project, iterations, options = {}) {
  const upTo = options.upToVersion ?? Infinity
  const includeCode = options.includeCode !== false

  const history = iterations
    .filter((it) => it.version <= upTo)
    .map((it) => `### ${it.kind === 'initial' ? 'Pedido inicial' : `Cambios pedidos (v${it.version})`}\n${it.promptReadable}`)
    .join('\n\n')

  const base = previousWithCode(iterations, upTo === Infinity ? Infinity : upTo)
  const reference = base || latestWithCode(iterations)

  const parts = [
    `Estoy retomando un proyecto: el juego "${project.title}"${
      project.studentName ? ` hecho por ${project.studentName}` : ''
    }.`,
    '',
    'Esto es todo lo que se pidio hasta ahora, en orden:',
    '',
    history
  ]

  if (includeCode && reference) {
    parts.push(
      '',
      `Y este es el codigo de la ultima version que funciona (v${reference.version}). Partí de aca:`,
      '',
      '```html',
      codeOf(reference),
      '```'
    )
  }

  return parts.join('\n')
}

export function iterationCodeText(iteration) {
  return codeOf(iteration)
}
