import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconSwap } from '../components/Icons'
import { ExercisePicker } from '../components/ExercisePicker'
import { getExercise } from '../engine/exercises'
import type { Feel, Plan, Profile, SetLog } from '../engine/types'
import { kg, relativeDay, setsText, toneFor } from '../format'
import { actions, type ActiveExercise, type ActiveSession } from '../store'

interface Rest {
  endsAt: number
  total: number
  label: string
}

export function SessionScreen({
  active,
  plan,
  profile,
  onFinished,
}: {
  active: ActiveSession
  plan: Plan
  profile: Profile
  onFinished: () => void
}) {
  const [rest, setRest] = useState<Rest | null>(null)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const elapsed = useElapsed(active.startedAt)

  const totals = active.exercises.reduce(
    (acc, ex) => ({ done: acc.done + ex.sets.filter((s) => s.done).length, all: acc.all + ex.sets.length }),
    { done: 0, all: 0 },
  )

  const startRest = (seconds: number, label: string) => setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, label })

  const finish = () => {
    if (totals.done === totals.all) {
      actions.finishSession()
      onFinished()
    } else {
      setConfirm(true)
    }
  }

  return (
    <>
      <header className="session-bar">
        <div>
          <h1>{active.dayName}</h1>
          <div className="small muted num">
            {elapsed} min, {totals.done} de {totals.all} series
          </div>
        </div>
        <button className="btn btn-primary" onClick={finish}>
          Terminar
        </button>
      </header>

      {active.exercises.map((ex, i) => (
        <ExerciseBlock
          key={`${i}-${ex.exerciseId}`}
          ex={ex}
          index={i}
          onRest={startRest}
          onSwap={() => setSwapIndex(i)}
        />
      ))}

      <div style={{ height: rest ? 88 : 0 }} />

      {rest && <RestTimer rest={rest} onAdd={() => setRest({ ...rest, endsAt: rest.endsAt + 30_000, total: rest.total + 30 })} onClose={() => setRest(null)} />}

      {swapIndex !== null && (
        <ExercisePicker
          plan={plan}
          profile={profile}
          dayId={active.dayId}
          index={swapIndex}
          currentId={active.exercises[swapIndex].exerciseId}
          mode="session"
          onApply={(id, inPlan) => {
            actions.swapExercise(swapIndex, id, inPlan)
            setSwapIndex(null)
          }}
          onClose={() => setSwapIndex(null)}
        />
      )}

      {confirm && (
        <div className="scrim" onClick={() => setConfirm(false)}>
          <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            {totals.done === 0 ? (
              <>
                <h2>No has marcado ninguna serie</h2>
                <p className="muted small">Si terminas ahora, esta sesión no se guardará.</p>
              </>
            ) : (
              <>
                <h2>Te quedan {totals.all - totals.done} series sin marcar</h2>
                <p className="muted small">Guardamos solo las series marcadas. Las que faltan cuentan como no hechas para calcular tu próxima sesión.</p>
              </>
            )}
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Seguir entrenando
              </button>
              {totals.done > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    actions.finishSession()
                    onFinished()
                  }}
                >
                  Guardar y terminar
                </button>
              )}
              <button className="btn btn-danger" onClick={() => actions.discardSession()}>
                Descartar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ExerciseBlock({
  ex,
  index,
  onRest,
  onSwap,
}: {
  ex: ActiveExercise
  index: number
  onRest: (seconds: number, label: string) => void
  onSwap: () => void
}) {
  const info = getExercise(ex.exerciseId)
  const rx = ex.prescription
  const tone = toneFor(rx.mode)
  const bodyweight = info.kind === 'corporal'
  const [invalid, setInvalid] = useState<number | null>(null)
  const anyDone = ex.sets.some((s) => s.done)

  const changeWeight = (setIndex: number, weight: number) => {
    const old = ex.sets[setIndex].weight
    actions.updateSet(index, setIndex, { weight })
    // Carry the new weight to the following sets that still had the old one.
    ex.sets.forEach((s, j) => {
      if (j > setIndex && !s.done && s.weight === old) actions.updateSet(index, j, { weight })
    })
    if (invalid === setIndex) setInvalid(null)
  }

  const toggle = (setIndex: number, s: SetLog) => {
    if (s.done) {
      actions.updateSet(index, setIndex, { done: false })
      return
    }
    if ((!bodyweight && s.weight <= 0) || s.reps <= 0) {
      setInvalid(setIndex)
      return
    }
    actions.updateSet(index, setIndex, { done: true })
    const remaining = ex.sets.filter((x, j) => j !== setIndex && !x.done).length
    onRest(ex.plan.rest, remaining > 0 ? 'Descanso' : 'Siguiente ejercicio')
  }

  return (
    <section className="ex" aria-labelledby={`ex-${index}`}>
      <div className="ex-head">
        <div>
          <h2 id={`ex-${index}`}>{info.name}</h2>
          <div className="small muted num">
            {ex.plan.sets} series de {ex.plan.repMin}–{ex.plan.repMax} reps
          </div>
        </div>
        <button className="ex-swap" onClick={onSwap}>
          <IconSwap style={{ verticalAlign: '-3px', marginRight: 4 }} />
          Cambiar
        </button>
      </div>

      <div className={`note ${tone}`}>{rx.note}</div>
      {rx.last && (
        <div className="last num">
          {relativeDay(rx.last.date)}: {setsText(rx.last.log)}
        </div>
      )}

      <div className="sets">
        <div className="set-row set-head" aria-hidden>
          <span className="idx">#</span>
          <span>{bodyweight ? 'Lastre' : 'Peso'}</span>
          <span>Reps</span>
          <span />
        </div>
        {ex.sets.map((s, j) => (
          <div className={`set-row${s.done ? ' done' : ''}`} key={j}>
            <span className="idx num">{j + 1}</span>
            <NumField
              value={s.weight}
              unit="kg"
              decimal
              placeholder={bodyweight ? '0' : '—'}
              invalid={invalid === j && !bodyweight && s.weight <= 0}
              label={`Peso serie ${j + 1}`}
              onChange={(v) => changeWeight(j, v)}
            />
            <NumField
              value={s.reps}
              unit="reps"
              placeholder={`${ex.plan.repMin}–${ex.plan.repMax}`}
              invalid={invalid === j && s.reps <= 0}
              label={`Repeticiones serie ${j + 1}`}
              onChange={(v) => actions.updateSet(index, j, { reps: v })}
            />
            <button
              className="check"
              aria-pressed={s.done}
              aria-label={s.done ? `Desmarcar serie ${j + 1}` : `Marcar serie ${j + 1} como hecha`}
              onClick={() => toggle(j, s)}
            >
              <IconCheck />
            </button>
          </div>
        ))}
      </div>
      {invalid !== null && <p className="small" style={{ color: 'var(--down)', margin: '8px 0 0' }}>Anota el peso y las repeticiones antes de marcar la serie.</p>}
      <button className="add-set" onClick={() => actions.addSet(index)}>
        + Añadir serie
      </button>

      {anyDone && (
        <div className="feel">
          <p>¿Cómo se sintió?</p>
          <div className="feel-opts">
            {(
              [
                ['facil', 'Fácil', 'Sobraban 3+'],
                ['justo', 'Justo', 'Sobraban 1–2'],
                ['limite', 'Al límite', 'Ni una más'],
              ] as [Feel, string, string][]
            ).map(([value, label, hint]) => (
              <button key={value} aria-pressed={ex.feel === value} onClick={() => actions.setFeel(index, value)}>
                {label}
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function NumField({
  value,
  unit,
  decimal,
  placeholder,
  invalid,
  label,
  onChange,
}: {
  value: number
  unit: string
  decimal?: boolean
  placeholder?: string
  invalid?: boolean
  label: string
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(value > 0 ? kg(value) : '')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(value > 0 ? kg(value) : '')
  }, [value])

  return (
    <label className={`field${invalid ? ' invalid' : ''}`}>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          focused.current = true
          e.target.select()
        }}
        onBlur={() => {
          focused.current = false
          setText(value > 0 ? kg(value) : '')
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '')
          setText(raw)
          const parsed = parseFloat(raw.replace(',', '.'))
          onChange(Number.isFinite(parsed) ? (decimal ? parsed : Math.round(parsed)) : 0)
        }}
      />
      <span>{unit}</span>
    </label>
  )
}

function RestTimer({ rest, onAdd, onClose }: { rest: Rest; onAdd: () => void; onClose: () => void }) {
  const [now, setNow] = useState(Date.now())
  const alerted = useRef(false)

  useEffect(() => {
    alerted.current = false
  }, [rest.endsAt])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const left = Math.round((rest.endsAt - now) / 1000)
  const over = left <= 0

  useEffect(() => {
    if (over && !alerted.current) {
      alerted.current = true
      navigator.vibrate?.([200, 100, 200])
      beep()
    }
  }, [over])

  const shown = Math.abs(left)
  const time = `${over ? '+' : ''}${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`
  const ratio = Math.max(0, Math.min(1, left / rest.total))

  return (
    <div className={`timer${over ? ' over' : ''}`} role="timer" aria-live="off">
      <div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} />
      <span className="timer-time num">{time}</span>
      <span className="timer-label">{over ? '¡A darle!' : rest.label}</span>
      {!over && <button onClick={onAdd}>+30 s</button>}
      <button onClick={onClose}>{over ? 'Cerrar' : 'Saltar'}</button>
    </div>
  )
}

function useElapsed(startedAt: string): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000))
}

let audio: AudioContext | null = null
function beep() {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.4)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.4)
  } catch {
    // Audio not available: vibration and the visual cue are enough.
  }
}
