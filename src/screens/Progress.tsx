import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SessionEditor } from '../components/SessionEditor'
import { findExercise } from '../engine/exercises'
import { bestE1rm, historyFor } from '../engine/progression'
import type { Session } from '../engine/types'
import { kg, relativeDay, setsText, shortDate, weekStart } from '../format'

const WEEKS = 8

export function Progress({ sessions, targetDays }: { sessions: Session[]; targetDays: number }) {
  const weeks = useMemo(() => weeklyCounts(sessions), [sessions])
  const streak = useMemo(() => weekStreak(weeks, targetDays), [weeks, targetDays])

  const exerciseIds = useMemo(() => {
    const counts = new Map<string, number>()
    sessions.forEach((s) => s.exercises.forEach((e) => counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => findExercise(id))
  }, [sessions])

  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Session | null>(null)
  const [showAll, setShowAll] = useState(false)
  const newestFirst = [...sessions].reverse()
  const visible = showAll ? newestFirst : newestFirst.slice(0, 8)
  const exerciseId = selected && exerciseIds.includes(selected) ? selected : exerciseIds[0]
  const history = exerciseId ? historyFor(exerciseId, sessions) : []
  const data = history.map((h) => ({
    date: shortDate(h.date),
    e1rm: Math.round(bestE1rm(h.log) * 10) / 10,
    peso: Math.max(...h.log.sets.map((s) => s.weight)),
  }))
  const first = data[0]?.e1rm ?? 0
  const lastE1 = data[data.length - 1]?.e1rm ?? 0
  const change = first > 0 ? Math.round(((lastE1 - first) / first) * 100) : 0

  return (
    <>
      <div className="topbar">
        <h1 className="h2">Progreso</h1>
      </div>

      <div className="stats">
        <div className="stat">
          <b className="num">{sessions.length}</b>
          <span>Sesiones</span>
        </div>
        <div className="stat">
          <b className="num">{streak}</b>
          <span>{streak === 1 ? 'Semana cumplida seguida' : 'Semanas cumplidas seguidas'}</span>
        </div>
        <div className="stat">
          <b className="num">{weeks[WEEKS - 1].count}</b>
          <span>Esta semana, de {targetDays}</span>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Constancia</h2>
          <span className="small muted">Últimas {WEEKS} semanas</span>
        </div>
        <div className="weeks" role="img" aria-label={`Entrenamientos por semana: ${weeks.map((w) => w.count).join(', ')}`}>
          {weeks.map((w, i) => (
            <div className="week-col" key={i}>
              <div
                className={`bar${w.count >= targetDays ? ' met' : w.count > 0 ? ' part' : ''}`}
                style={{ height: `${Math.min(1, w.count / targetDays) * 100}%` }}
              />
              <span className="num">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Fuerza por ejercicio</h2>
        </div>
        {exerciseIds.length === 0 ? (
          <div className="empty">Cuando completes tu primera sesión verás aquí cómo evoluciona cada ejercicio.</div>
        ) : (
          <>
            <select className="select" value={exerciseId} onChange={(e) => setSelected(e.target.value)} aria-label="Ejercicio">
              {exerciseIds.map((id) => (
                <option key={id} value={id}>
                  {findExercise(id)!.name}
                </option>
              ))}
            </select>

            {data.length > 1 && data[0].peso > 0 && (
              <p className="small" style={{ margin: '12px 0 0' }}>
                <span style={{ color: change >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 650 }}>
                  {change >= 0 ? '+' : ''}
                  {change}%
                </span>{' '}
                <span className="muted">de fuerza estimada desde tu primera sesión</span>
              </p>
            )}

            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#2a3456" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8d96b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#8d96b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1f2843', border: '1px solid #2a3456', borderRadius: 10, fontSize: 13 }}
                    labelStyle={{ color: '#8d96b8' }}
                    formatter={(v, name) => [`${kg(Number(v))} kg`, name === 'e1rm' ? 'Fuerza estimada' : 'Peso usado']}
                  />
                  <Line type="monotone" dataKey="e1rm" stroke="#9a8cff" strokeWidth={2.5} dot={{ r: 3, fill: '#9a8cff' }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="peso" stroke="#8d96b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: '#9a8cff' }} />
                Fuerza estimada (1RM)
              </span>
              <span>
                <i style={{ background: '#8d96b8' }} />
                Peso usado
              </span>
            </div>

            <table className="log-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Series</th>
                  <th>1RM est.</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i}>
                    <td>{shortDate(h.date)}</td>
                    <td className="num">{setsText(h.log)}</td>
                    <td className="num">{kg(Math.round(bestE1rm(h.log) * 10) / 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Historial</h2>
          <span className="small muted">Toca para corregir</span>
        </div>
        {newestFirst.length === 0 ? (
          <div className="empty">Aún no hay sesiones guardadas.</div>
        ) : (
          <>
            {visible.map((s) => (
              <button className="history-btn" key={s.id} onClick={() => setEditing(s)}>
                <span>{s.dayName}</span>
                <span className="meta">
                  {relativeDay(s.date)}, {s.exercises.reduce((n, e) => n + e.sets.length, 0)} series
                </span>
              </button>
            ))}
            {newestFirst.length > visible.length && (
              <button className="add-exercise" onClick={() => setShowAll(true)}>
                Ver las {newestFirst.length} sesiones
              </button>
            )}
          </>
        )}
      </section>

      {editing && <SessionEditor session={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function weeklyCounts(sessions: Session[], now = new Date()): { label: string; count: number }[] {
  const current = weekStart(now)
  return Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(current)
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const count = sessions.filter((s) => {
      const t = new Date(s.date).getTime()
      return t >= start.getTime() && t < end.getTime()
    }).length
    return { label: i === WEEKS - 1 ? 'Esta' : `${start.getDate()}/${start.getMonth() + 1}`, count }
  })
}

function weekStreak(weeks: { count: number }[], target: number): number {
  let streak = 0
  // The current week only counts once it is met; an unfinished week does not break the streak.
  const lastIndex = weeks.length - 1
  if (weeks[lastIndex].count >= target) streak++
  for (let i = lastIndex - 1; i >= 0; i--) {
    if (weeks[i].count >= target) streak++
    else break
  }
  return streak
}
