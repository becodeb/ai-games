import { useEffect, useState } from 'react'
import GameFrame from './GameFrame.jsx'
import { useToast } from './Toast.jsx'
import { api } from '../lib/api.js'
import { stripCodeFences } from '../lib/code.js'

/**
 * "Ya tengo la respuesta de la IA": pegar, ver como queda y publicar la version.
 * Lo usa el alumno cuando hace el ciclo completo por su cuenta.
 */
export default function CodeDrop({ iterationId, title, initialCode = '', publishedBy = 'student', onSaved }) {
  const toast = useToast()
  const [code, setCode] = useState(initialCode)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCode(initialCode)
  }, [iterationId, initialCode])

  useEffect(() => {
    if (!code.trim()) {
      setPreview('')
      return undefined
    }
    let alive = true
    const timer = setTimeout(() => {
      api
        .preview({ html: code, title })
        .then((data) => alive && setPreview(data.document || ''))
        .catch(() => alive && setPreview(''))
    }, 450)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [code, title])

  async function publish() {
    if (!code.trim()) {
      toast('Primero pega el codigo que te dio la IA', 'error')
      return
    }
    setSaving(true)
    try {
      const data = await api.saveIterationCode(iterationId, { html: code, css: '', js: '', publishedBy })
      toast('Version publicada', 'ok')
      onSaved?.(data)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drop">
      <label className="field">
        <span className="field__label">Pega aca lo que te devolvio la IA</span>
        <textarea
          className="input input--code"
          rows={8}
          spellCheck={false}
          placeholder="<!DOCTYPE html> ..."
          value={code}
          onChange={(event) => {
            const raw = event.target.value
            setCode(/^\s*```/.test(raw) ? stripCodeFences(raw) : raw)
          }}
        />
      </label>

      {preview ? (
        <GameFrame srcDoc={preview} title="Asi te quedo" height={380} />
      ) : (
        <p className="note">Cuando pegues el codigo vas a ver el juego aca abajo, antes de publicarlo.</p>
      )}

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={publish} disabled={saving || !code.trim()}>
          Publicar esta version
        </button>
      </div>
    </div>
  )
}
