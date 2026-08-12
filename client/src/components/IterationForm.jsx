import { useMemo, useState } from 'react'
import { PromptBlock, TextArea } from './ui.jsx'
import {
  ITERATION_FIELDS,
  ITERATION_SLOTS,
  buildIterationFull,
  buildIterationReadable,
  countIterationChanges
} from '../lib/prompt.js'

/**
 * Formulario de iteracion. Empuja a juntar varios cambios en un solo envio
 * en lugar de mandar un pedido por cada detalle.
 */
export default function IterationForm({ title, version, detectedError, busy, onSubmit }) {
  const [fields, setFields] = useState({ ...ITERATION_FIELDS })
  const [showPrompt, setShowPrompt] = useState(false)

  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }))

  const context = { title, version }
  const changes = countIterationChanges(fields)
  const readable = useMemo(() => buildIterationReadable(fields, context), [fields, title, version])
  const full = useMemo(() => buildIterationFull(fields, context), [fields, title, version])

  const canSend = changes > 0

  function useDetectedError() {
    setFields((current) => ({
      ...current,
      fix: current.fix.trim()
        ? current.fix
        : `El juego muestra este error: "${detectedError}". Encontralo y arreglalo.`
    }))
  }

  function handle(send) {
    if (!canSend || busy) return
    onSubmit({ fields, readable, full, send }, () => setFields({ ...ITERATION_FIELDS }))
  }

  return (
    <section className="iteration-form">
      <header className="iteration-form__head">
        <div>
          <h3>Pedido de mejoras — version {version + 1}</h3>
          <p>
            Junta varios cambios en un solo pedido. Ideal: <strong>1 arreglo + 1 mejora visual + 1 regla nueva</strong>.
            Cada envio ocupa el tiempo de un profe, asi que aprovechalo.
          </p>
        </div>
        <span className={`counter${changes >= 2 ? ' counter--good' : ''}`}>
          {changes} {changes === 1 ? 'cambio' : 'cambios'}
        </span>
      </header>

      {detectedError ? (
        <div className="hint-row">
          <span className="hint-row__text">Se detecto un error mientras jugabas: {detectedError}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={useDetectedError}>
            Usarlo como arreglo
          </button>
        </div>
      ) : null}

      <div className="form-grid form-grid--two">
        {ITERATION_SLOTS.map((slot) => (
          <TextArea
            key={slot.key}
            label={slot.label}
            hint={slot.hint}
            rows={3}
            placeholder={slot.placeholder}
            value={fields[slot.key]}
            onChange={set(slot.key)}
            maxLength={500}
          />
        ))}
      </div>

      <button type="button" className="link-button" onClick={() => setShowPrompt((value) => !value)}>
        {showPrompt ? 'Ocultar el pedido armado' : 'Ver como queda el pedido'}
      </button>

      {showPrompt ? <PromptBlock text={readable} label={`Pedido de la version ${version + 1}`} /> : null}

      <div className="actions">
        <button type="button" className="btn" onClick={() => handle(false)} disabled={!canSend || busy}>
          Copiar prompt
        </button>
        <button type="button" className="btn btn--primary" onClick={() => handle(true)} disabled={!canSend || busy}>
          Enviar a los profes
        </button>
      </div>

      {!canSend ? <p className="note">Escribi al menos un cambio para poder enviar.</p> : null}
    </section>
  )
}
