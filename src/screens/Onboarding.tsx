import { useState } from 'react'
import { getExercise } from '../engine/exercises'
import { buildPlan } from '../engine/plan'
import type { Equipment, Experience, Goal, Injury, Profile, Situation } from '../engine/types'
import { actions } from '../store'

interface Option<T> {
  value: T
  label: string
  hint?: string
}

const GOALS: Option<Goal>[] = [
  { value: 'hipertrofia', label: 'Ganar músculo', hint: 'Más volumen y rangos de 8 a 12 repeticiones' },
  { value: 'grasa', label: 'Perder grasa', hint: 'Mantener la fuerza mientras bajas de peso' },
  { value: 'fuerza', label: 'Ganar fuerza', hint: 'Pocas repeticiones con pesos altos' },
  { value: 'salud', label: 'Salud y constancia', hint: 'Entrenar parejo sin terminar agotado' },
]

const EXPERIENCE: Option<Experience>[] = [
  { value: 'nuevo', label: 'Nunca he entrenado en serio' },
  { value: 'menos1', label: 'Menos de un año' },
  { value: 'mas1', label: 'Más de un año' },
]

const SITUATION: Option<Situation>[] = [
  { value: 'entreno', label: 'Entreno actualmente', hint: 'Llevo varias semanas seguidas' },
  { value: 'regreso', label: 'Vuelvo después de una pausa', hint: 'Partimos con pesos cómodos y subimos rápido' },
  { value: 'cero', label: 'Empiezo desde cero', hint: 'Aprendes la técnica con pesos livianos' },
]

const DAYS: Option<number>[] = [2, 3, 4, 5, 6].map((d) => ({ value: d, label: String(d) }))
const MINUTES: Option<number>[] = [30, 45, 60, 75, 90].map((m) => ({ value: m, label: String(m) }))

const EQUIPMENT: Option<Equipment>[] = [
  { value: 'gimnasio', label: 'Gimnasio completo', hint: 'Barras, mancuernas y máquinas' },
  { value: 'basico', label: 'Gimnasio básico', hint: 'Barras, mancuernas y banco, sin máquinas' },
  { value: 'casa', label: 'En casa', hint: 'Mancuernas y banco' },
]

const INJURIES: Option<Injury>[] = [
  { value: 'hombro', label: 'Hombro' },
  { value: 'rodilla', label: 'Rodilla' },
  { value: 'espalda', label: 'Espalda baja' },
]

interface Draft {
  goal?: Goal
  experience?: Experience
  situation?: Situation
  days?: number
  minutes?: number
  equipment?: Equipment
  injuries: Injury[]
}

const STEPS = 8

export function Onboarding({ initial, onCancel }: { initial?: Profile; onCancel?: () => void }) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(initial ? { ...initial } : { injuries: [] })

  const choose = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setStep((s) => s + 1)
  }

  const profile: Profile | null =
    draft.goal && draft.experience && draft.situation && draft.days && draft.minutes && draft.equipment
      ? {
          goal: draft.goal,
          experience: draft.experience,
          situation: draft.situation,
          days: draft.days,
          minutes: draft.minutes,
          equipment: draft.equipment,
          injuries: draft.injuries,
          createdAt: initial?.createdAt ?? new Date().toISOString(),
        }
      : null

  const plan = step === 7 && profile ? buildPlan(profile) : null

  const back = () => (step === 0 ? onCancel?.() : setStep((s) => s - 1))

  return (
    <div className="ob">
      <div className="topbar">
        <span className="wordmark">
          g<b>AI</b>nlab
        </span>
        <span className="muted small num">
          {Math.min(step + 1, STEPS)} de {STEPS}
        </span>
      </div>
      <div className="ob-progress" aria-hidden>
        <span style={{ width: `${(Math.min(step + 1, STEPS) / STEPS) * 100}%` }} />
      </div>

      {step === 0 && (
        <Question title="¿Qué quieres lograr?">
          <Choices options={GOALS} value={draft.goal} onPick={(v) => choose('goal', v)} />
        </Question>
      )}
      {step === 1 && (
        <Question title="¿Cuánta experiencia tienes entrenando?">
          <Choices options={EXPERIENCE} value={draft.experience} onPick={(v) => choose('experience', v)} />
        </Question>
      )}
      {step === 2 && (
        <Question title="¿Cuál es tu situación ahora?">
          <Choices options={SITUATION} value={draft.situation} onPick={(v) => choose('situation', v)} />
        </Question>
      )}
      {step === 3 && (
        <Question title="¿Cuántos días por semana puedes entrenar?" lede="Elige lo que puedas sostener, no lo ideal.">
          <Choices options={DAYS} value={draft.days} onPick={(v) => choose('days', v)} grid />
        </Question>
      )}
      {step === 4 && (
        <Question title="¿Cuántos minutos dura cada sesión?">
          <Choices options={MINUTES} value={draft.minutes} onPick={(v) => choose('minutes', v)} grid />
        </Question>
      )}
      {step === 5 && (
        <Question title="¿Dónde entrenas?">
          <Choices options={EQUIPMENT} value={draft.equipment} onPick={(v) => choose('equipment', v)} />
        </Question>
      )}
      {step === 6 && (
        <Question title="¿Tienes molestias en alguna zona?" lede="Puedes marcar varias. Si tienes una lesión, consulta con un profesional.">
          <div className="options">
            {INJURIES.map((o) => {
              const on = draft.injuries.includes(o.value)
              return (
                <button
                  key={o.value}
                  className="option"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      injuries: on ? d.injuries.filter((i) => i !== o.value) : [...d.injuries, o.value],
                    }))
                  }
                >
                  <strong>{o.label}</strong>
                </button>
              )
            })}
          </div>
        </Question>
      )}
      {step === 7 && plan && (
        <div>
          <p className="muted small">Tu plan</p>
          <h1 className="display" style={{ marginTop: 4 }}>
            {plan.name}
          </h1>
          <p className="lede">{plan.summary}</p>
          <div className="section">
            {plan.days.map((day) => (
              <div className="plan-day" key={day.id}>
                <h3>{day.name}</h3>
                <ol>
                  {day.exercises.map((e) => (
                    <li key={e.exerciseId}>
                      <span>{getExercise(e.exerciseId).name}</span>
                      <span className="num">
                        {e.sets} × {e.repMin}–{e.repMax}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ob-foot">
        {(step > 0 || onCancel) && (
          <button className="btn btn-ghost" onClick={back}>
            Atrás
          </button>
        )}
        {step === 6 && (
          <button className="btn btn-primary" onClick={() => setStep(7)}>
            {draft.injuries.length === 0 ? 'Ninguna, continuar' : 'Continuar'}
          </button>
        )}
        {step === 7 && profile && (
          <button className="btn btn-primary" onClick={() => actions.completeOnboarding(profile)}>
            Empezar con este plan
          </button>
        )}
      </div>
    </div>
  )
}

function Question({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="ob-q">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </div>
  )
}

function Choices<T>({
  options,
  value,
  onPick,
  grid,
}: {
  options: Option<T>[]
  value?: T
  onPick: (v: T) => void
  grid?: boolean
}) {
  return (
    <div className={`options${grid ? ' grid-3' : ''}`}>
      {options.map((o) => (
        <button key={String(o.value)} className="option" aria-pressed={value === o.value} onClick={() => onPick(o.value)}>
          {grid ? (
            o.label
          ) : (
            <>
              <strong>{o.label}</strong>
              {o.hint && <span>{o.hint}</span>}
            </>
          )}
        </button>
      ))}
    </div>
  )
}
