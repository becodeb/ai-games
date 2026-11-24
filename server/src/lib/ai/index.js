import { createAiQueue } from './queue.js'

let notifier = () => {}

/** Cola unica del proceso. El aviso en vivo se conecta despues (ver app.js) para no acoplar con realtime. */
export const ai = createAiQueue({ onChange: (iterationId) => notifier(iterationId) })

export function setAiNotifier(fn) {
  notifier = fn
}
