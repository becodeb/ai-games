import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import GalleryButton from '../components/GalleryButton.jsx'
import { PromptBlock, SectionTitle, Select, TextArea, TextInput } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { copyToClipboard } from '../lib/format.js'
import { rememberProject, getStudentName, setStudentName } from '../lib/storage.js'
import {
  CONTROL_OPTIONS,
  GAME_TYPES,
  INITIAL_FIELDS,
  buildInitialFull,
  buildInitialReadable
} from '../lib/prompt.js'

const REQUIRED = ['title', 'character', 'winRule']

export default function NewGame() {
  const navigate = useNavigate()
  const toast = useToast()
  const [fields, setFields] = useState(() => ({ ...INITIAL_FIELDS, studentName: getStudentName() }))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }))

  const readable = useMemo(() => buildInitialReadable(fields), [fields])
  const full = useMemo(() => buildInitialFull(fields), [fields])

  const missing = REQUIRED.filter((key) => !(fields[key] || '').trim())
  const typeHint = GAME_TYPES.find((t) => t.value === fields.gameType)?.hint

  async function submit(send) {
    if (missing.length) {
      setTouched(true)
      toast('Completa los campos marcados con *', 'error')
      return
    }

    setBusy(true)
    try {
      // El copiado tiene que salir del gesto del usuario, por eso va antes del await.
      let copied = false
      if (!send) copied = await copyToClipboard(full)

      const detail = await api.createProject({
        title: fields.title,
        studentName: fields.studentName,
        fields,
        promptReadable: readable,
        promptFull: full,
        send
      })

      rememberProject(detail.project.id)
      setStudentName(fields.studentName)
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
      <SectionTitle
        eyebrow="Paso 1"
        title="Armá tu primer pedido"
        description="Cada campo que completes le da mas informacion a la IA. Cuanto mas claro, mejor sale el juego."
        actions={
          <Link className="btn btn--ghost" to="/">
            Volver
          </Link>
        }
      />

      <div className="split">
        <div className="panel">
          <div className="form-grid">
            <TextInput
              label="Titulo del juego"
              required
              placeholder="Ej.: La fuga del laboratorio"
              value={fields.title}
              onChange={set('title')}
              maxLength={80}
              aria-invalid={touched && !fields.title.trim()}
            />
            <TextInput
              label="Tu nombre o el del equipo"
              placeholder="Ej.: Sol y Bauti"
              value={fields.studentName}
              onChange={set('studentName')}
              maxLength={60}
            />

            <Select
              label="Tipo de juego"
              hint={typeHint}
              options={GAME_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={fields.gameType}
              onChange={set('gameType')}
            />

            {fields.gameType === 'personalizado' ? (
              <TextInput
                label="Conta como se juega"
                placeholder="Ej.: hay que ordenar residuos en el tacho correcto antes de que se acabe el tiempo"
                value={fields.customGameType}
                onChange={set('customGameType')}
                maxLength={200}
              />
            ) : null}

            <TextInput
              label="Personaje o protagonista"
              required
              placeholder="Ej.: un gato astronauta de color naranja"
              value={fields.character}
              onChange={set('character')}
              maxLength={160}
              aria-invalid={touched && !fields.character.trim()}
            />

            <TextInput
              label="Fondo o escenario"
              placeholder="Ej.: una ciudad de noche con lluvia"
              value={fields.setting}
              onChange={set('setting')}
              maxLength={160}
            />

            <TextArea
              label="Regla para ganar"
              required
              rows={2}
              placeholder="Ej.: juntar 20 estrellas antes de que se termine el tiempo"
              value={fields.winRule}
              onChange={set('winRule')}
              maxLength={300}
              aria-invalid={touched && !fields.winRule.trim()}
            />

            <TextArea
              label="Regla para perder"
              rows={2}
              placeholder="Ej.: chocar tres veces con un meteorito"
              value={fields.loseRule}
              onChange={set('loseRule')}
              maxLength={300}
            />

            <Select
              label="Controles"
              options={CONTROL_OPTIONS}
              value={fields.controls}
              onChange={set('controls')}
            />

            <TextArea
              label="Algo especial (opcional)"
              rows={2}
              hint="Sonidos, colores, un jefe final, niveles..."
              placeholder="Ej.: que cada 30 segundos aparezca un power-up que te haga mas rapido"
              value={fields.extra}
              onChange={set('extra')}
              maxLength={300}
            />
          </div>
        </div>

        <aside className="panel panel--sticky">
          <PromptBlock text={readable} label="Asi le vas a pedir el juego a la IA" />

          <p className="note">
            Cuando copies o envies el pedido, el sistema le agrega automaticamente las reglas tecnicas que la IA
            necesita: un unico archivo HTML, sin librerias externas y con manejo de errores.
          </p>

          <div className="actions">
            <button type="button" className="btn btn--lg" onClick={() => submit(false)} disabled={busy}>
              Copiar prompt
            </button>
            <button type="button" className="btn btn--lg btn--primary" onClick={() => submit(true)} disabled={busy}>
              Enviar a los profes
            </button>
          </div>

          {touched && missing.length ? (
            <p className="alert alert--error">Te faltan campos obligatorios (*).</p>
          ) : null}
        </aside>
      </div>
    </Layout>
  )
}
