import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

/** Pide el nombre del profe para marcar quien atiende cada proyecto. */
export default function NameModal({ open, current, onSave, onClose }) {
  const [name, setName] = useState(current || '')

  useEffect(() => {
    if (open) setName(current || '')
  }, [open, current])

  return (
    <Modal
      open={open}
      onClose={onClose || (() => {})}
      title="Como te llamas?"
      description="Se usa para marcar quien esta atendiendo cada proyecto."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) onSave(name.trim())
        }}
      >
        <input
          className="input"
          placeholder="Tu nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            Listo
          </button>
        </div>
      </form>
    </Modal>
  )
}
