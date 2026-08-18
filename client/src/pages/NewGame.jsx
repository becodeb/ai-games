import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import GalleryButton from '../components/GalleryButton.jsx'
import PromptEditor from '../components/PromptEditor.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { copyToClipboard } from '../lib/format.js'
import { rememberProject, getStudentName, setStudentName } from '../lib/storage.js'
import {
  INITIAL_FIELDS,
  INITIAL_LINES,
  INITIAL_REQUIRED,
  TECHNICAL_INSTRUCTIONS,
  missingRequired,
  renderPrompt,
  withInstructions
} from '../lib/prompt.js'

export default function NewGame() {
  const navigate = useNavigate()
  const toast = useToast()
  const [values, setValues] = useState(() => ({ ...INITIAL_FIELDS, studentName: getStudentName() }))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const readable = useMemo(() => renderPrompt(INITIAL_LINES, values), [values])
  const full = useMemo(() => withInstructions(readable, TECHNICAL_INSTRUCTIONS), [readable])
  const missing = missingRequired(INITIAL_LINES, values, INITIAL_REQUIRED)

  const change = (key, value) => setValues((current) => ({ ...current, [key]: value }))

  async function submit(send) {
    if (missing.length) {
      setTouched(true)
      toast('Faltan completar algunos huecos del prompt', 'error')
      return
    }

    setBusy(true)
    try {
      // El copiado tiene que salir del gesto del usuario, por eso va antes del await.
      let copied = false
      if (!send) copied = await copyToClipboard(full)

      const detail = await api.createProject({
        title: values.title,
        studentName: values.studentName,
        fields: values,
        promptReadable: readable,
        promptFull: full,
        send
      })

      rememberProject(detail.project.id)
      setStudentName(values.studentName)
      toast(send ? 'Enviado a los profes' : copied ? 'Prompt copiado' : 'Guardado (copialo a mano)', 'ok')
      navigate(`/proyecto/${detail.project.id}`)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout actions={<GalleryButton />}>
      <div className="compose">
        <div className="compose__head">
          <div>
            <span className="eyebrow">Tu prompt</span>
            <h1>Completá los huecos</h1>
          </div>
          <Link className="btn btn--ghost" to="/">
            Volver
          </Link>
        </div>

        <PromptEditor
          lines={INITIAL_LINES}
          values={values}
          onChange={change}
          invalid={touched ? missing : []}
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

        {showRules ? <pre className="rules">{TECHNICAL_INSTRUCTIONS}</pre> : null}
      </div>
    </Layout>
  )
}
