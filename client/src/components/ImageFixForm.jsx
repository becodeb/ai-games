import { useMemo, useState } from 'react'
import ImagePromptBox from './ImagePromptBox.jsx'
import ImageAttachments from './ImageAttachments.jsx'
import {
  IMAGE_FIX_HINTS,
  IMAGE_FIX_INSTRUCTIONS,
  IMAGE_FIX_PLACEHOLDER,
  IMAGE_FIX_PREFIX,
  renderImagePrompt,
  withImageInstructions
} from '../lib/imagePrompt.js'

/**
 * Pedido de correccion sobre la imagen elegida.
 * Mismo formato que el pedido inicial: comienzo fijo + texto libre + adjuntos.
 */
export default function ImageFixForm({ version, busy, chosen, needsChoice, onSubmit }) {
  const [text, setText] = useState('')
  const [references, setReferences] = useState([])
  const [touched, setTouched] = useState(false)

  const readable = useMemo(() => renderImagePrompt(IMAGE_FIX_PREFIX, text), [text])
  const full = useMemo(() => withImageInstructions(readable, IMAGE_FIX_INSTRUCTIONS), [readable])

  const written = Boolean(text.trim())
  const blocked = needsChoice && !chosen
  const canSend = written && !blocked

  function handle(send) {
    if (busy) return
    if (!canSend) {
      setTouched(true)
      return
    }
    onSubmit(
      {
        promptText: text,
        readable,
        full,
        references,
        baseAssetId: chosen?.id || '',
        send
      },
      () => {
        setText('')
        setReferences([])
        setTouched(false)
      }
    )
  }

  return (
    <section className="compose compose--nested">
      <div className="compose__head">
        <div>
          <span className="eyebrow">Version {version + 1}</span>
          <h2>Corregi lo que no te gusto</h2>
        </div>
      </div>

      {chosen ? (
        <div className="chosen">
          <img className="chosen__thumb" src={chosen.url} alt="La imagen que elegiste" />
          <div>
            <strong>Vas a corregir esta imagen</strong>
            <p className="muted">
              Se la mandamos al profe como referencia junto con tu pedido. Podes cambiar de imagen tocando
              &quot;Elegir esta&quot; en otra opcion.
            </p>
          </div>
        </div>
      ) : needsChoice ? (
        <p className={`note${touched ? ' note--warn' : ''}`}>
          Primero elegi cual de las imagenes queres seguir mejorando.
        </p>
      ) : null}

      <ImagePromptBox
        prefix={IMAGE_FIX_PREFIX}
        value={text}
        onChange={setText}
        placeholder={IMAGE_FIX_PLACEHOLDER}
        hints={IMAGE_FIX_HINTS}
        invalid={touched && !written}
        minRows={4}
        disabled={busy}
      />

      <ImageAttachments
        items={references}
        onChange={setReferences}
        max={4}
        label="Sumar otra referencia (opcional)"
        hint="Por ejemplo un dibujo tuyo o una foto parecida a lo que queres lograr."
        disabled={busy}
      />

      <div className="compose__actions">
        <button type="button" className="btn btn--lg" onClick={() => handle(false)} disabled={busy}>
          Copiar prompt
        </button>
        <button type="button" className="btn btn--lg btn--primary" onClick={() => handle(true)} disabled={busy}>
          Enviar a los profes
        </button>
      </div>
    </section>
  )
}
