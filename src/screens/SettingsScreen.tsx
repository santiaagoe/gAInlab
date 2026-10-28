import { useRef, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { getExercise } from '../engine/exercises'
import type { Plan, Profile, Settings } from '../engine/types'
import { kg } from '../format'
import { actions, exportData, type AppState } from '../store'

interface Props {
  plan: Plan
  profile: Profile
  settings: Settings
  onRedoSurvey: () => void
}

const INCREMENTS: { key: keyof Settings; label: string; hint: string; options: number[] }[] = [
  { key: 'incBarra', label: 'Barra', hint: 'Lo mínimo que puedes sumar con discos', options: [1, 2.5, 5] },
  { key: 'incMancuerna', label: 'Mancuernas', hint: 'Salto entre una mancuerna y la siguiente', options: [1, 2, 2.5] },
  { key: 'incMaquina', label: 'Máquinas y poleas', hint: 'Salto entre placas', options: [2.5, 5] },
]

export function SettingsScreen({ plan, profile, settings, onRedoSurvey }: Props) {
  const [editing, setEditing] = useState<{ dayId: string; index: number } | null>(null)
  const [confirmRedo, setConfirmRedo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gainlab-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Respaldo descargado.')
  }

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState
      if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('formato')
      actions.importData(data)
      setMessage(`Respaldo restaurado: ${data.sessions.length} sesiones.`)
    } catch {
      setMessage('Ese archivo no es un respaldo de gAInlab. Elige el .json que descargaste desde esta pantalla.')
    }
  }

  return (
    <>
      <div className="topbar">
        <h1 className="h2">Ajustes</h1>
      </div>

      {message && (
        <div className="banner" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Tu plan</h2>
          <button className="link" onClick={() => (plan.edited ? setConfirmRedo(true) : onRedoSurvey())}>
            Rehacer encuesta
          </button>
        </div>
        <p style={{ margin: 0, fontWeight: 600 }}>{plan.name}</p>
        <p className="lede small">{plan.summary}</p>
        <div style={{ marginTop: 12 }}>
          {plan.days.map((day) => (
            <div className="plan-day" key={day.id}>
              <h3>{day.name}</h3>
              <ol>
                {day.exercises.map((e, i) => (
                  <li key={e.exerciseId}>
                    <button
                      className="plan-edit"
                      onClick={() => setEditing({ dayId: day.id, index: i })}
                      aria-label={`Cambiar ${getExercise(e.exerciseId).name}`}
                    >
                      <span>
                        {getExercise(e.exerciseId).name}
                        <span className="edit-hint">Cambiar</span>
                      </span>
                      <span className="num">
                        {e.sets} × {e.repMin}–{e.repMax}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="small muted">Toca un ejercicio para cambiarlo por otro. Al rehacer la encuesta conservas todo tu historial.</p>
        {confirmRedo && (
          <div className="stack" style={{ marginTop: 8 }}>
            <p className="small" style={{ margin: 0 }}>
              Cambiaste ejercicios de tu rutina. Al rehacer la encuesta se genera una rutina nueva y esos cambios se pierden; tu historial se mantiene.
            </p>
            <button className="btn btn-primary" onClick={onRedoSurvey}>
              Rehacer encuesta
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmRedo(false)}>
              Mantener mi rutina
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="h2">Saltos de peso</h2>
        <p className="lede small">Cuánto sube la app cada vez que completas el rango. Ajústalo a los pesos de tu gimnasio.</p>
        {INCREMENTS.map((inc) => (
          <div className="row" key={inc.key}>
            <div>
              <div style={{ fontWeight: 600 }}>{inc.label}</div>
              <div className="small muted">{inc.hint}</div>
            </div>
            <div className="seg" role="group" aria-label={inc.label}>
              {inc.options.map((o) => (
                <button
                  key={o}
                  aria-pressed={settings[inc.key] === o}
                  onClick={() => actions.updateSettings({ ...settings, [inc.key]: o })}
                >
                  {kg(o)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2 className="h2">Tus datos</h2>
        <p className="lede small">
          Todo se guarda solo en este celular. Descarga un respaldo de vez en cuando para no perder tu historial.
        </p>
        <div className="stack" style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={download}>
            Descargar respaldo
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Restaurar respaldo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) restore(f)
              e.target.value = ''
            }}
          />
          {confirmReset ? (
            <div className="stack">
              <p className="small" style={{ margin: 0 }}>
                Se borrarán tu plan y todas tus sesiones. No se puede deshacer.
              </p>
              <button className="btn btn-danger" onClick={() => actions.resetAll()}>
                Borrar todo
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
              Borrar todos los datos
            </button>
          )}
        </div>
      </section>

      {editing && (
        <ExercisePicker
          plan={plan}
          profile={profile}
          dayId={editing.dayId}
          index={editing.index}
          currentId={plan.days.find((d) => d.id === editing.dayId)!.exercises[editing.index].exerciseId}
          mode="plan"
          onApply={(id) => {
            actions.replaceInPlan(editing.dayId, editing.index, id)
            setEditing(null)
            setMessage(`Rutina actualizada: ahora haces ${getExercise(id).name.toLowerCase()}.`)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <p className="small muted" style={{ marginTop: 32, textAlign: 'center' }}>
        gAInlab versión 0.1
      </p>
    </>
  )
}
