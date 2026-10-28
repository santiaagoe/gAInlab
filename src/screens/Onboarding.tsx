import { useState } from 'react'
import { PlanEditor } from '../components/PlanEditor'
import { buildPlan } from '../engine/plan'
import { emptyDays, emptyPlan } from '../engine/planEdit'
import type { Equipment, Experience, Goal, Injury, Plan, Profile, Situation } from '../engine/types'
import { actions, useApp } from '../store'

type Mode = 'generar' | 'propio'

type Step = 'modo' | 'goal' | 'experience' | 'situation' | 'days' | 'minutes' | 'equipment' | 'injuries' | 'plan' | 'builder'

const FLOWS: Record<Mode, Step[]> = {
  generar: ['modo', 'goal', 'experience', 'situation', 'days', 'minutes', 'equipment', 'injuries', 'plan'],
  propio: ['modo', 'goal', 'days', 'equipment', 'injuries', 'builder'],
}

const MODES: Option<Mode>[] = [
  { value: 'generar', label: 'Arma un plan para mí', hint: 'Respondes 7 preguntas y te propongo una rutina que puedes ajustar' },
  { value: 'propio', label: 'Ya tengo un plan', hint: 'Copias tu rutina y gAInlab calcula el peso de cada sesión' },
]

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
  mode?: Mode
  goal?: Goal
  experience?: Experience
  situation?: Situation
  days?: number
  minutes?: number
  equipment?: Equipment
  injuries: Injury[]
}

export function Onboarding({ initial, onCancel }: { initial?: Profile; onCancel?: () => void }) {
  const { notes } = useApp()
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<Draft>(initial ? { ...initial } : { injuries: [] })
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planKey, setPlanKey] = useState('')
  const [tried, setTried] = useState(false)

  const flow = FLOWS[draft.mode ?? 'generar']
  const step = flow[index]
  const own = draft.mode === 'propio'

  const profile = profileFrom(draft, initial)

  /** Moves to a step, preparing the plan draft when reaching the last one. */
  const goTo = (next: number, nextDraft: Draft = draft) => {
    const nextFlow = FLOWS[nextDraft.mode ?? 'generar']
    const target = nextFlow[next]
    if (target === 'plan' || target === 'builder') {
      const p = profileFrom(nextDraft, initial)
      if (p) {
        // Regenerate only if the answers that shape the plan changed, so edits survive going back and forth.
        const key = target === 'plan' ? JSON.stringify({ ...p, createdAt: '' }) : `propio-${p.days}`
        if (key !== planKey || !plan) {
          if (target === 'plan' || !plan?.custom) setPlan(target === 'plan' ? buildPlan(p) : emptyPlan(p.days))
          setPlanKey(key)
        }
      }
    }
    setTried(false)
    setIndex(next)
    window.scrollTo({ top: 0 })
  }

  const choose = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    goTo(index + 1, next)
  }

  const back = () => (index === 0 ? onCancel?.() : goTo(index - 1))

  const missing = plan ? emptyDays(plan) : []
  const start = () => {
    if (!profile || !plan) return
    if (step === 'builder' && missing.length > 0) {
      setTried(true)
      return
    }
    actions.completeOnboarding(profile, plan)
  }

  return (
    <div className="ob">
      <div className="topbar">
        <span className="wordmark">
          g<b>AI</b>nlab
        </span>
        <span className="muted small num">
          {index + 1} de {flow.length}
        </span>
      </div>
      <div className="ob-progress" aria-hidden>
        <span style={{ width: `${((index + 1) / flow.length) * 100}%` }} />
      </div>

      {step === 'modo' && (
        <Question title="¿Cómo quieres empezar?">
          <Choices options={MODES} value={draft.mode} onPick={(v) => choose('mode', v)} />
        </Question>
      )}
      {step === 'goal' && (
        <Question
          title="¿Qué quieres lograr?"
          lede={own ? 'Lo usamos para proponer series y repeticiones cuando añadas un ejercicio.' : undefined}
        >
          <Choices options={GOALS} value={draft.goal} onPick={(v) => choose('goal', v)} />
        </Question>
      )}
      {step === 'experience' && (
        <Question title="¿Cuánta experiencia tienes entrenando?">
          <Choices options={EXPERIENCE} value={draft.experience} onPick={(v) => choose('experience', v)} />
        </Question>
      )}
      {step === 'situation' && (
        <Question title="¿Cuál es tu situación ahora?">
          <Choices options={SITUATION} value={draft.situation} onPick={(v) => choose('situation', v)} />
        </Question>
      )}
      {step === 'days' && (
        <Question
          title={own ? '¿Cuántos días tiene tu plan?' : '¿Cuántos días por semana puedes entrenar?'}
          lede={own ? 'Después puedes añadir o quitar días.' : 'Elige lo que puedas sostener, no lo ideal.'}
        >
          <Choices options={DAYS} value={draft.days} onPick={(v) => choose('days', v)} grid />
        </Question>
      )}
      {step === 'minutes' && (
        <Question title="¿Cuántos minutos dura cada sesión?">
          <Choices options={MINUTES} value={draft.minutes} onPick={(v) => choose('minutes', v)} grid />
        </Question>
      )}
      {step === 'equipment' && (
        <Question title="¿Dónde entrenas?" lede={own ? 'Así te mostramos solo los ejercicios que puedes hacer.' : undefined}>
          <Choices options={EQUIPMENT} value={draft.equipment} onPick={(v) => choose('equipment', v)} />
        </Question>
      )}
      {step === 'injuries' && (
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
      {step === 'plan' && plan && profile && (
        <div>
          <p className="muted small">Tu plan</p>
          <h1 className="display" style={{ marginTop: 4 }}>
            {plan.name}
          </h1>
          <p className="lede">{plan.summary}</p>
          <div className="note ai" style={{ marginTop: 16 }}>
            Toca cualquier ejercicio para cambiarlo, ajustar series y repeticiones o quitarlo. También puedes añadir ejercicios y días.
          </div>
          {plan.edited && (
            <button className="link" style={{ marginTop: 12 }} onClick={() => setPlan(buildPlan(profile))}>
              Volver al plan propuesto
            </button>
          )}
          <div className="section">
            <PlanEditor plan={plan} profile={profile} notes={notes} onChange={setPlan} />
          </div>
        </div>
      )}
      {step === 'builder' && plan && profile && (
        <div>
          <h1 className="ob-q">Copia tu plan</h1>
          <p className="lede">
            Añade los ejercicios de cada día con sus series y repeticiones. Toca el nombre de un día para cambiarlo, por ejemplo
            “Pecho y tríceps”. Si un ejercicio no está en la lista, puedes crearlo.
          </p>
          <div className="section">
            <PlanEditor plan={plan} profile={profile} notes={notes} onChange={setPlan} />
          </div>
          {tried && missing.length > 0 && (
            <div className="note down" style={{ marginTop: 16 }} role="alert">
              {missing.length === 1
                ? `${missing[0].name} no tiene ejercicios. Añade al menos uno o quita ese día.`
                : `${missing.slice(0, -1).map((d) => d.name).join(', ')} y ${missing[missing.length - 1].name} no tienen ejercicios. Añade al menos uno a cada día o quítalos.`}
            </div>
          )}
        </div>
      )}

      <div className="ob-foot">
        {(index > 0 || onCancel) && (
          <button className="btn btn-ghost" onClick={back}>
            Atrás
          </button>
        )}
        {step === 'injuries' && (
          <button className="btn btn-primary" onClick={() => goTo(index + 1)}>
            {draft.injuries.length === 0 ? 'Ninguna, continuar' : 'Continuar'}
          </button>
        )}
        {(step === 'plan' || step === 'builder') && profile && (
          <button className="btn btn-primary" onClick={start}>
            {step === 'plan' ? 'Empezar con este plan' : 'Empezar con mi plan'}
          </button>
        )}
      </div>
    </div>
  )
}

function profileFrom(d: Draft, initial?: Profile): Profile | null {
  const own = d.mode === 'propio'
  if (!d.goal || !d.days || !d.equipment) return null
  if (!own && (!d.experience || !d.situation || !d.minutes)) return null
  return {
    goal: d.goal,
    experience: d.experience ?? 'menos1',
    situation: d.situation ?? 'entreno',
    days: d.days,
    minutes: d.minutes ?? 60,
    equipment: d.equipment,
    injuries: d.injuries,
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  }
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
