/**
 * Llamada a la API de Anthropic con el SDK oficial. El cliente se crea recien al usarlo y solo si
 * hay ANTHROPIC_API_KEY. Nada de esto sale al navegador: los errores se traducen a mensajes cortos.
 */
import Anthropic from '@anthropic-ai/sdk'
import { MAX_TOKENS, readConfig } from './config.js'

/** Error con un mensaje apto para mostrarle al profe. `code` sirve para tests y logs. */
export class GenerationError extends Error {
  constructor(message, code = 'generation') {
    super(message)
    this.code = code
  }
}

let cached = null

function getClient(apiKey) {
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined
  if (!cached || cached.apiKey !== apiKey || cached.baseURL !== baseURL) {
    cached = { apiKey, baseURL, client: new Anthropic({ apiKey, baseURL, maxRetries: 2 }) }
  }
  return cached.client
}

/** Traduce un error del SDK (o de red) a un GenerationError. Del mas especifico al mas general. */
export function translateError(error, signal) {
  if (error instanceof GenerationError) return error
  if (signal?.aborted || error instanceof Anthropic.APIUserAbortError) return new GenerationError('Se cancelo la generacion.', 'aborted')
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new GenerationError('La clave de la IA no es valida o no tiene permiso. Avisale a quien administra la app.', 'auth')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new GenerationError('La IA tiene demasiados pedidos ahora (o se acabo el credito). Espera un rato y proba de nuevo.', 'rate_limit')
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new GenerationError('La IA tardo demasiado en responder. Proba de nuevo.', 'timeout')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new GenerationError('No se pudo conectar con la IA. Revisa la conexion a internet y proba de nuevo.', 'connection')
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new GenerationError('El modelo de IA configurado no existe o no esta disponible. Avisale a quien administra la app.', 'model')
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new GenerationError('La IA no pudo procesar este pedido (puede ser demasiado largo). Proba con un pedido mas corto.', 'bad_request')
  }
  if (error instanceof Anthropic.InternalServerError || (error instanceof Anthropic.APIError && error.status >= 500)) {
    return new GenerationError('La IA esta con problemas o sobrecargada. Proba de nuevo en un rato.', 'server')
  }
  if (error instanceof Anthropic.APIError) {
    return new GenerationError('La IA devolvio un error. Proba de nuevo.', 'api')
  }
  return new GenerationError('Fallo inesperado al generar el juego. Proba de nuevo.', 'unknown')
}

/**
 * @param {{system: string, user: string, signal?: AbortSignal}} input
 * @returns {Promise<{text: string, model: string, inputTokens: number, outputTokens: number}>}
 */
export async function generateGame({ system, user, signal }) {
  const config = readConfig()
  if (!config.enabled) throw new GenerationError('La IA no esta configurada.', 'disabled')

  try {
    const stream = getClient(process.env.ANTHROPIC_API_KEY.trim()).beta.messages.stream(
      {
        model: config.model,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        output_config: { effort: config.effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: user }]
      },
      { signal }
    )
    const message = await stream.finalMessage()

    // stop_reason primero: un refusal o un corte por largo nunca deben tratarse como un juego terminado.
    if (message.stop_reason === 'refusal') {
      throw new GenerationError('La IA no quiso hacer este pedido. Reformulalo con otras palabras o pedile algo distinto.', 'refusal')
    }
    if (message.stop_reason === 'max_tokens' || message.stop_reason === 'model_context_window_exceeded') {
      throw new GenerationError('El juego quedo cortado porque era demasiado largo. Proba pidiendo algo mas simple.', 'truncated')
    }

    const text = (message.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    if (!text.trim()) throw new GenerationError('La IA no devolvio nada. Proba de nuevo.', 'empty')

    return {
      text,
      model: message.model || config.model,
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0
    }
  } catch (error) {
    const translated = translateError(error, signal)
    // Solo tipo y estado: nunca el cuerpo crudo ni la clave.
    if (translated.code !== 'aborted' && !(error instanceof GenerationError)) {
      console.warn(`[ai] fallo la llamada: ${error?.name || 'Error'} status=${error?.status ?? '-'} request=${error?.requestID ?? '-'}`)
    }
    throw translated
  }
}
