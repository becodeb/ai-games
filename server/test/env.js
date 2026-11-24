/**
 * Se importa PRIMERO en cada test: deja el entorno listo antes de que db.js y compania lo lean
 * (base temporal, sin Chromium, IA apuntando a un falso Anthropic local). Nunca toca la API real.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFakeAnthropic } from './fake-anthropic.js'

export const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'steamlab-test-'))
// Todo sincrono (sin top-level await): asi el entorno queda fijado antes de que se evalue db.js.
for (const name of ['AI_AUTO', 'AI_MAX_CONCURRENCY', 'AI_DAILY_LIMIT', 'AI_EFFORT', 'ANTHROPIC_MODEL']) delete process.env[name]
process.env.DATABASE_PATH = path.join(tmpDir, 'steamlab.db')
process.env.THUMBS_DISABLED = '1'
process.env.ANTHROPIC_API_KEY = 'test-key-123'

export const fake = createFakeAnthropic()

/** Cada test espera esto en su `before`: levanta el falso y apunta el SDK ahi (se lee recien al llamar). */
export const ready = fake.listen().then(() => {
  process.env.ANTHROPIC_BASE_URL = fake.url
})
