import { useState } from 'react'
import { SessionEditor } from '../components/SessionEditor'
import { getExercise } from '../engine/exercises'
import { dayFocus } from '../engine/planEdit'
import { historyFor, prescribe } from '../engine/progression'
import type { Plan, Session, Settings } from '../engine/types'
import { chipText, kg, relativeDay, sessionsThisWeek, toneFor } from '../format'
import { actions, nextDay } from '../store'

interface Props {
  plan: Plan
  sessions: Session[]
  settings: Settings
  targetDays: number
  justFinished: Session | null
  onDismissFinished: () => void
}

export function Today({ plan, sessions, settings, targetDays, justFinished, onDismissFinished }: Props) {
  const suggested = nextDay(plan, sessions)
  const [dayId, setDayId] = useState(suggested.id)
  const [editing, setEditing] = useState<Session | null>(null)
  const day = plan.days.find((d) => d.id === dayId) ?? suggested
  const week = sessionsThisWeek(sessions)
  const recent = sessions.slice(-4).reverse()

  return (
    <>
      <div className="topbar">
        <span className="wordmark">
          g<b>AI</b>nlab
        </span>
      </div>

      <div className="week">
        <div className="week-dots" aria-hidden>
          {Array.from({ length: targetDays }, (_, i) => (
            <i key={i} className={i < week ? 'on' : ''} />
          ))}
        </div>
        <span className="small muted num">
          {week >= targetDays ? 'Semana cumplida' : `Esta semana: ${week} de ${targetDays}`}
        </span>
      </div>

      {justFinished && (
        <div className="banner" role="status">
          <span>
            Sesión guardada: {plural(justFinished.exercises.length, 'ejercicio', 'ejercicios')},{' '}
            {plural(justFinished.exercises.reduce((n, e) => n + e.sets.length, 0), 'serie', 'series')}.
          </span>
          <button onClick={onDismissFinished} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}

      <section className="hero">
        <div className="eyebrow">{day.id === suggested.id ? 'Hoy toca' : 'Elegiste'}</div>
        <h1 className="display">{day.name}</h1>
        <p className="lede">{dayFocus(day)}</p>

        <div className="rx-list">
          {day.exercises.map((pe) => {
            const ex = getExercise(pe.exerciseId)
            const rx = prescribe(pe, historyFor(pe.exerciseId, sessions), settings)
            const tone = toneFor(rx.mode)
            const reps = rx.reps.every((r) => r === rx.reps[0]) ? `${rx.reps.length} × ${rx.reps[0]}` : rx.reps.join(', ')
            return (
              <div className="rx" key={pe.exerciseId}>
                <div className="rx-name">{ex.name}</div>
                <div className="rx-load">
                  {rx.weight === null ? (
                    <div className="rx-weight calib">Calibrar</div>
                  ) : rx.weight === 0 ? (
                    <div className="rx-weight calib">Peso corporal</div>
                  ) : (
                    <div className="rx-weight num">
                      {kg(rx.weight)}
                      <small>kg</small>
                    </div>
                  )}
                  {rx.mode !== 'calibracion' && <span className={`chip ${tone}`}>{chipText(rx.mode, rx.delta)}</span>}
                </div>
                <div className="rx-sub num">
                  {rx.mode === 'calibracion' ? `${pe.sets} series de ${pe.repMin}–${pe.repMax}` : `${reps} reps`}
                </div>
              </div>
            )
          })}
        </div>

        {day.exercises.length === 0 ? (
          <div className="empty" style={{ marginTop: 20 }}>
            {day.name} no tiene ejercicios. Añádelos en Ajustes, en Tu plan.
          </div>
        ) : (
          <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => actions.startSession(day)}>
            Empezar entrenamiento
          </button>
        )}
      </section>

      {plan.days.length > 1 && (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">Hacer otro día</h2>
          </div>
          <div className="day-picker">
            {plan.days.map((d) => (
              <button key={d.id} aria-pressed={d.id === day.id} onClick={() => setDayId(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Últimas sesiones</h2>
        </div>
        {recent.length === 0 ? (
          <div className="empty">Tu primera sesión aparecerá aquí.</div>
        ) : (
          <>
            {recent.map((s) => (
              <button className="history-btn" key={s.id} onClick={() => setEditing(s)}>
                <span>{s.dayName}</span>
                <span className="meta">
                  {relativeDay(s.date)}, {s.exercises.reduce((n, e) => n + e.sets.length, 0)} series
                </span>
              </button>
            ))}
            <p className="small muted">Toca una sesión para corregir lo que anotaste.</p>
          </>
        )}
      </section>

      {editing && <SessionEditor session={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
