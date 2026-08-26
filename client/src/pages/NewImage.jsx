import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import ImagePromptBox from '../components/ImagePromptBox.jsx'
import ImageAttachments from '../components/ImageAttachments.jsx'
import ImageGalleryButton from '../components/ImageGalleryButton.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { copyToClipboard } from '../lib/format.js'
import { getStudentName, rememberImageProject, setStudentName } from '../lib/storage.js'
import {
  IMAGE_HINTS,
  IMAGE_INSTRUCTIONS,
  IMAGE_PLACEHOLDER,
  IMAGE_PREFIX,
  renderImagePrompt,
  withImageInstructions
} from '../lib/imagePrompt.js'

export default function NewImage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [studentName, setName] = useState(() => getStudentName())
  const [text, setText] = useState('')
  const [references, setReferences] = useState([])
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const readable = useMemo(() => renderImagePrompt(IMAGE_PREFIX, text), [text])
  const full = useMemo(() => withImageInstructions(readable, IMAGE_INSTRUCTIONS), [readable])

  const missingTitle = !title.trim()
  const missingText = !text.trim()

  async function submit(send) {
    if (missingTitle || missingText) {
      setTouched(true)
      toast(missingTitle ? 'Ponele un titulo a tu imagen' : 'Conta que imagen queres', 'error')
      return
    }

    setBusy(true)
    try {
      // El copiado tiene que salir del gesto del usuario, por eso va antes del await.
      let copied = false
      if (!send) copied = await copyToClipboard(full)

      const detail = await api.images.createProject({
        title,
        studentName,
        promptText: text,
        promptReadable: readable,
        promptFull: full,
        references,
        send
      })

      rememberImageProject(detail.project.id)
      setStudentName(studentName)
      toast(send ? 'Enviado a los profes' : copied ? 'Prompt copiado' : 'Guardado (copialo a mano)', 'ok')
      navigate(`/imagen/${detail.project.id}`)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout tagline="imagenes con IA" actions={<ImageGalleryButton />}>
      <div className="compose">
        <div className="compose__head">
          <div>
            <span className="eyebrow">Tu pedido de imagen</span>
            <h1>Contale a la IA que imagen queres</h1>
          </div>
          <Link className="btn btn--ghost" to="/">
            Volver
          </Link>
        </div>

        <div className="compose__meta">
          <label className="field">
            <span className="field__label">Titulo de la imagen</span>
            <input
              className={`input${touched && missingTitle ? ' input--invalid' : ''}`}
              placeholder="El gato astronauta"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
            />
          </label>
          <label className="field">
            <span className="field__label">Tu nombre (opcional)</span>
            <input
              className="input"
              placeholder="Como te llamas"
              value={studentName}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </label>
        </div>

        <ImagePromptBox
          prefix={IMAGE_PREFIX}
          value={text}
          onChange={setText}
          placeholder={IMAGE_PLACEHOLDER}
          hints={IMAGE_HINTS}
          invalid={touched && missingText}
          disabled={busy}
        />

        <ImageAttachments
          items={references}
          onChange={setReferences}
          max={4}
          label="Adjuntar imagenes de referencia (opcional)"
          hint="Sirve para mostrar el estilo, un dibujo tuyo o algo parecido a lo que tenes en la cabeza."
          disabled={busy}
        />

        <div className="compose__actions">
          <button type="button" className="btn btn--lg" onClick={() => submit(false)} disabled={busy}>
            Copiar prompt
          </button>
          <button type="button" className="btn btn--lg btn--primary" onClick={() => submit(true)} disabled={busy}>
            Enviar a los profes
          </button>
          <button type="button" className="link-button" onClick={() => setShowRules((value) => !value)}>
            {showRules ? 'Ocultar reglas tecnicas' : 'Ver reglas tecnicas que se agregan'}
          </button>
        </div>

        {showRules ? <pre className="rules">{IMAGE_INSTRUCTIONS}</pre> : null}
      </div>
    </Layout>
  )
}
