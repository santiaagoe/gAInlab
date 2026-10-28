import { useEffect, useRef, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import { IconCheck, IconFocus, IconList, IconNext, IconPrev, IconSwap } from '../components/Icons'
import { NumField } from '../components/NumField'
import { getExercise } from '../engine/exercises'
import { incrementFor, warmupSets } from '../engine/progression'
import type { Feel, Plan, Profile, SetLog, Settings } from '../engine/types'
import { kg, relativeDay, setsText, toneFor } from '../format'
import { actions, type ActiveExercise, type ActiveSession } from '../store'

interface Rest {
  endsAt: number
  total: number
  label: string
}

interface Props {
  active: ActiveSession
  plan: Plan
  profile: Profile
  settings: Settings
  notes: Record<string, string>
  onFinished: () => void
}

export function SessionScreen({ active, plan, profile, settings, notes, onFinished }: Props) {
  const [rest, setRest] = useState<Rest | null>(null)
  const [swapIndex, setSwapIndex] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const elapsed = useElapsed(active.startedAt)
  const focus = settings.sessionView === 'enfoque'
  const current = Math.min(active.current ?? 0, active.exercises.length - 1)
  const isLast = current === active.exercises.length - 1

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

  const go = (index: number) => {
    actions.setCurrent(index)
    window.scrollTo({ top: 0 })
  }

  const nextName = (i: number) => {
    const next = active.exercises[i + 1]
    return next ? getExercise(next.exerciseId).name : null
  }

  const block = (ex: ActiveExercise, i: number) => (
    <ExerciseBlock
      key={`${i}-${ex.exerciseId}`}
      ex={ex}
      index={i}
      total={active.exercises.length}
      settings={settings}
      note={notes[ex.exerciseId] ?? ''}
      nextName={nextName(i)}
      onRest={startRest}
      onSwap={() => setSwapIndex(i)}
    />
  )

  return (
    <>
      <header className="session-bar">
        <div>
          <h1>{active.dayName}</h1>
          <div className="small muted num">
            {elapsed} min, {totals.done} de {totals.all} series
          </div>
        </div>
        <div className="session-actions">
          <button
            className="icon-btn"
            onClick={() => actions.updateSettings({ ...settings, sessionView: focus ? 'lista' : 'enfoque' })}
            aria-label={focus ? 'Ver todos los ejercicios en lista' : 'Ver un ejercicio a la vez'}
            title={focus ? 'Ver en lista' : 'Ver uno a la vez'}
          >
            {focus ? <IconList /> : <IconFocus />}
          </button>
          <button className="btn btn-primary" onClick={finish}>
            Terminar
          </button>
        </div>
      </header>

      {focus ? (
        <>
          <ExerciseStrip active={active} current={current} onSelect={go} />
          <Swipe onPrev={() => current > 0 && go(current - 1)} onNext={() => !isLast && go(current + 1)}>
            {block(active.exercises[current], current)}
          </Swipe>
          <div style={{ height: 96 + (rest ? 76 : 0) }} />
          <FocusNav
            current={current}
            ex={active.exercises[current]}
            nextName={nextName(current)}
            onPrev={() => go(current - 1)}
            onNext={() => go(current + 1)}
            onFinish={finish}
          />
        </>
      ) : (
        <>
          {active.exercises.map(block)}
          <div style={{ height: rest ? 88 : 0 }} />
        </>
      )}

      {rest && (
        <RestTimer
          rest={rest}
          raised={focus}
          onAdd={() => setRest({ ...rest, endsAt: rest.endsAt + 30_000, total: rest.total + 30 })}
          onClose={() => setRest(null)}
        />
      )}

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
                <p className="muted small">
                  Guardamos solo las series marcadas. Las que faltan cuentan como no hechas para calcular tu próxima sesión.
                </p>
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

/* ---------- Focus mode ---------- */

function ExerciseStrip({ active, current, onSelect }: { active: ActiveSession; current: number; onSelect: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-current="step"]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <nav className="strip" ref={ref} aria-label="Ejercicios de la sesión">
      {active.exercises.map((ex, i) => {
        const done = ex.sets.filter((s) => s.done).length
        const complete = done === ex.sets.length && ex.sets.length > 0
        return (
          <button
            key={`${i}-${ex.exerciseId}`}
            className={`strip-item${complete ? ' complete' : ''}`}
            aria-current={i === current ? 'step' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className="strip-num num">{complete ? <IconCheck width={14} height={14} /> : i + 1}</span>
            <span className="strip-name">{getExercise(ex.exerciseId).name}</span>
            <span className="strip-sets num">
              {done}/{ex.sets.length}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function FocusNav({
  current,
  ex,
  nextName,
  onPrev,
  onNext,
  onFinish,
}: {
  current: number
  ex: ActiveExercise
  nextName: string | null
  onPrev: () => void
  onNext: () => void
  onFinish: () => void
}) {
  const complete = ex.sets.every((s) => s.done)
  return (
    <div className="focus-nav">
      <div className="focus-nav-inner">
        <button className="btn btn-ghost focus-prev" onClick={onPrev} disabled={current === 0} aria-label="Ejercicio anterior">
          <IconPrev />
        </button>
        {nextName ? (
          <button className={`btn ${complete ? 'btn-primary' : 'btn-ghost'} focus-next`} onClick={onNext}>
            <span className="focus-next-text">
              <small>Siguiente</small>
              {nextName}
            </span>
            <IconNext />
          </button>
        ) : (
          <button className={`btn ${complete ? 'btn-primary' : 'btn-ghost'} focus-next`} onClick={onFinish}>
            Terminar entrenamiento
          </button>
        )}
      </div>
    </div>
  )
}

/** Horizontal swipe to move between exercises, ignored while typing in a field. */
function Swipe({ children, onPrev, onNext }: { children: React.ReactNode; onPrev: () => void; onNext: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      onTouchStart={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('input, textarea, button')) {
          start.current = null
          return
        }
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }}
      onTouchEnd={(e) => {
        if (!start.current) return
        const dx = e.changedTouches[0].clientX - start.current.x
        const dy = e.changedTouches[0].clientY - start.current.y
        start.current = null
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return
        if (dx < 0) onNext()
        else onPrev()
      }}
    >
      {children}
    </div>
  )
}

/* ---------- Exercise ---------- */

function ExerciseBlock({
  ex,
  index,
  total,
  settings,
  note,
  nextName,
  onRest,
  onSwap,
}: {
  ex: ActiveExercise
  index: number
  total: number
  settings: Settings
  note: string
  nextName: string | null
  onRest: (seconds: number, label: string) => void
  onSwap: () => void
}) {
  const info = getExercise(ex.exerciseId)
  const rx = ex.prescription
  const tone = toneFor(rx.mode)
  const bodyweight = info.kind === 'corporal'
  const [invalid, setInvalid] = useState<number | null>(null)
  const anyDone = ex.sets.some((s) => s.done)
  const nextSet = ex.sets.findIndex((s) => !s.done)

  const showWarmup = info.compound && ex.plan.role !== 'accesorio'
  const warmup = showWarmup ? warmupSets(ex.sets[0]?.weight ?? 0, info.kind, incrementFor(info.kind, settings)) : []

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
    const label = remaining > 0 ? `Descanso, ${remaining === 1 ? 'falta 1 serie' : `faltan ${remaining} series`}` : nextName ? 'Ejercicio listo' : 'Última serie lista'
    onRest(ex.plan.rest, label)
  }

  return (
    <section className="ex" aria-labelledby={`ex-${index}`}>
      <div className="ex-head">
        <div>
          <div className="small muted num">
            Ejercicio {index + 1} de {total}
          </div>
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

      <NoteLine exerciseId={ex.exerciseId} note={note} />

      {warmup.length > 0 && (
        <div className="warmup">
          <span className="warmup-label">Calentamiento</span>
          <span className="num">{warmup.map((w) => `${kg(w.weight)} kg × ${w.reps}`).join(', ')}</span>
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
          <div className={`set-row${s.done ? ' done' : ''}${j === nextSet ? ' next' : ''}`} key={j}>
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
      {invalid !== null && (
        <p className="small" style={{ color: 'var(--down)', margin: '8px 0 0' }}>
          Anota el peso y las repeticiones antes de marcar la serie.
        </p>
      )}
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

function NoteLine({ exerciseId, note }: { exerciseId: string; note: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note)

  if (editing) {
    return (
      <div className="note-edit">
        <textarea
          autoFocus
          rows={2}
          value={text}
          placeholder="Ej.: asiento en el 4, agarre cerrado"
          onChange={(e) => setText(e.target.value)}
          aria-label="Nota del ejercicio"
        />
        <div className="note-edit-actions">
          <button
            className="link"
            onClick={() => {
              setText(note)
              setEditing(false)
            }}
          >
            Cancelar
          </button>
          <button
            className="link"
            onClick={() => {
              actions.setNote(exerciseId, text)
              setEditing(false)
            }}
          >
            Guardar nota
          </button>
        </div>
      </div>
    )
  }

  return note ? (
    <button className="my-note" onClick={() => setEditing(true)}>
      <span className="my-note-label">Tu nota</span>
      {note}
    </button>
  ) : (
    <button className="add-note" onClick={() => setEditing(true)}>
      + Añadir nota
    </button>
  )
}

/* ---------- Rest timer ---------- */

function RestTimer({ rest, raised, onAdd, onClose }: { rest: Rest; raised: boolean; onAdd: () => void; onClose: () => void }) {
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
    <div className={`timer${over ? ' over' : ''}${raised ? ' raised' : ''}`} role="timer" aria-live="off">
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
