/**
 * Contexto para retomar la charla con la IA cuando se corto el chat.
 * Como las imagenes no se pueden pegar en texto, el resumen lleva los pedidos
 * en orden y aclara desde que version hay que partir; la imagen base se adjunta
 * a mano en el chat nuevo (esta a un clic de distancia en el panel).
 */

export function buildImageRestartContext(project, requests, { upToVersion, newPrompt } = {}) {
  const previous = requests
    .filter((request) => !upToVersion || request.version < upToVersion)
    .map((request) => `v${request.version}: ${request.promptReadable}`)

  const lines = [
    `Estamos trabajando en una imagen que se llama "${project.title}".`,
    project.studentName ? `La pidio ${project.studentName}.` : '',
    '',
    previous.length ? 'Esto es lo que se pidio hasta ahora, en orden:' : 'Todavia no hubo pedidos anteriores.',
    ...previous,
    '',
    newPrompt ? '--- PEDIDO NUEVO ---' : '',
    newPrompt || ''
  ]

  return lines.filter((line) => line !== null && line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** La ultima version anterior que tenga imagenes entregadas. */
export function previousWithResults(requests, version) {
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const request = requests[index]
    if (request.version < version && request.results.length) return request
  }
  return null
}
