import { useRef, useState } from 'react'
import { useToast } from './Toast.jsx'
import { ACCEPT_ATTR, filesToPayloads } from '../lib/imageFiles.js'

/**
 * Adjuntar imagenes desde el disco: las referencias del alumno o la tanda que
 * entrega el profe. Se pueden arrastrar arriba del recuadro o elegir con un clic.
 * Cada archivo queda como { name, dataUrl } y viaja en el JSON del pedido.
 */
export default function ImageAttachments({
  items = [],
  onChange,
  max = 4,
  kind = 'reference',
  label = 'Adjuntar imagenes',
  hint = '',
  disabled = false
}) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const full = items.length >= max

  async function add(fileList) {
    if (disabled || full) return
    const room = max - items.length
    setBusy(true)
    try {
      const payloads = await filesToPayloads(fileList, { kind, limit: room })
      if (payloads.length) onChange([...items, ...payloads])
      if ((fileList?.length || 0) > room) toast(`Solo entran ${max} imagenes`, 'error')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remove(index) {
    onChange(items.filter((_, position) => position !== index))
  }

  return (
    <div className="attach">
      <div className="attach__head">
        <span className="field__label">{label}</span>
        <span className="muted">
          {items.length}/{max}
        </span>
      </div>

      <div
        className={`attach__drop${dragging ? ' attach__drop--over' : ''}${full ? ' attach__drop--full' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!full && !disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          add(event.dataTransfer?.files)
        }}
      >
        {items.length ? (
          <div className="attach__grid">
            {items.map((item, index) => (
              <div className="attach__item" key={`${item.name}-${index}`}>
                <img src={item.dataUrl} alt={item.name || `Adjunto ${index + 1}`} />
                <button
                  type="button"
                  className="attach__remove"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  aria-label={`Sacar ${item.name || 'la imagen'}`}
                >
                  ×
                </button>
                <span className="attach__name">{item.name}</span>
              </div>
            ))}
          </div>
        ) : null}

        {!full ? (
          <button
            type="button"
            className="attach__button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            {busy ? 'Preparando...' : items.length ? 'Agregar otra' : 'Elegir imagenes o arrastralas aca'}
          </button>
        ) : null}

        <input
          ref={inputRef}
          className="attach__input"
          type="file"
          accept={ACCEPT_ATTR}
          multiple={max > 1}
          onChange={(event) => add(event.target.files)}
        />
      </div>

      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}
