import { useMemo, useState } from 'react'
import PromptEditor from './PromptEditor.jsx'
import {
  ITERATION_FIELDS,
  ITERATION_INSTRUCTIONS,
  ITERATION_LINES,
  countFilled,
  renderPrompt,
  withInstructions
} from '../lib/prompt.js'

/**
 * Pedido de mejoras, con el mismo formato de prompt-con-huecos.
 * Empuja a juntar varios cambios en un solo envio.
 */
export default function IterationForm({ version, busy, detectedError, onSubmit }) {
  const [values, setValues] = useState({ ...ITERATION_FIELDS })

  const readable = useMemo(() => renderPrompt(ITERATION_LINES, values), [values])
  const full = useMemo(() => withInstructions(readable, ITERATION_INSTRUCTIONS), [readable])
  const changes = countFilled(ITERATION_LINES, values)
  const canSend = changes > 0

  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }))

  function useDetectedError() {
    setValues((current) => ({
      ...current,
      fix: current.fix.trim() ? current.fix : `aparece el error "${detectedError}"`
    }))
  }

  function handle(send) {
    if (!canSend || busy) return
    onSubmit({ fields: values, readable, full, send }, () => setValues({ ...ITERATION_FIELDS }))
  }

  return (
    <section className="compose compose--nested">
      <div className="compose__head">
        <div>
          <span className="eyebrow">Version {version + 1}</span>
          <h2>Pedí varios cambios juntos</h2>
        </div>
        <span className={`counter${changes >= 2 ? ' counter--good' : ''}`}>
          {changes} {changes === 1 ? 'cambio' : 'cambios'}
        </span>
      </div>

      {detectedError ? (
        <div className="hint-row">
          <span className="hint-row__text">Error detectado: {detectedError}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={useDetectedError}>
            Usarlo
          </button>
        </div>
      ) : null}

      <PromptEditor lines={ITERATION_LINES} values={values} onChange={change} size="md" />

      <div className="compose__actions">
        <button type="button" className="btn btn--lg" onClick={() => handle(false)} disabled={!canSend || busy}>
          Copiar prompt
        </button>
        <button
          type="button"
          className="btn btn--lg btn--primary"
          onClick={() => handle(true)}
          disabled={!canSend || busy}
        >
          Enviar a los profes
        </button>
      </div>
    </section>
  )
}
