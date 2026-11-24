/**
 * Configuracion de la generacion con IA. Se lee del entorno en cada uso (no al importar),
 * asi un valor invalido nunca rompe el arranque: cae al valor por defecto.
 */

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

export const DEFAULT_MODEL = 'claude-opus-5-5'
export const MAX_TOKENS = 64000
export const MAX_TRIES = 2
export const PROMPT_CAP = 20_000
export const FEEDBACK_CAP = 4_000
export const CODE_CAP = 400_000

function positiveInt(value, fallback) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return fallback
  const number = Number(text)
  return number >= 1 ? number : fallback
}

function bool(value, fallback) {
  const text = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'si', 'on'].includes(text)) return true
  if (['false', '0', 'no', 'off'].includes(text)) return false
  return fallback
}

export function readConfig(env = process.env) {
  const effort = String(env.AI_EFFORT ?? '').trim().toLowerCase()
  return {
    enabled: Boolean(String(env.ANTHROPIC_API_KEY ?? '').trim()),
    auto: bool(env.AI_AUTO, true),
    model: String(env.ANTHROPIC_MODEL ?? '').trim() || DEFAULT_MODEL,
    effort: EFFORTS.includes(effort) ? effort : 'medium',
    maxConcurrency: positiveInt(env.AI_MAX_CONCURRENCY, 3),
    dailyLimit: positiveInt(env.AI_DAILY_LIMIT, 150)
  }
}
