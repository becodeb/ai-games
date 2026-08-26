import { useState } from 'react'
import ImageAttachments from './ImageAttachments.jsx'
import { useToast } from './Toast.jsx'
import { api } from '../lib/api.js'

/**
 * "Ya tengo las imagenes de la IA": subir la tanda y publicar la version.
 * Lo usa el alumno cuando hace el ciclo completo por su cuenta, igual que el
 * CodeDrop de los juegos.
 */
export default function ImageDrop({ requestId, publishedBy = 'student', onSaved }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [saving, setSaving] = useState(false)

  async function publish() {
    if (!items.length) {
      toast('Primero subi las imagenes que te dio la IA', 'error')
      return
    }
    setSaving(true)
    try {
      const data = await api.images.saveResults(requestId, { results: items, publishedBy })
      toast('Imagenes publicadas', 'ok')
      setItems([])
      onSaved?.(data)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drop">
      <ImageAttachments
        items={items}
        onChange={setItems}
        max={4}
        kind="result"
        label="Subi las 4 imagenes que te devolvio la IA"
        hint="Podes subir menos de 4 si la IA te dio menos."
        disabled={saving}
      />

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={publish} disabled={saving || !items.length}>
          Publicar esta version
        </button>
      </div>
    </div>
  )
}
