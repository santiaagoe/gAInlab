import type { ExerciseLog, Feel, PrescriptionMode, Session } from './engine/types'
import { calendarDaysBetween, kg } from './engine/units'

export { clock, formatKg, kg } from './engine/units'

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function relativeDay(iso: string, now = new Date()): string {
  const diff = calendarDaysBetween(new Date(iso), now)
  // A date in the future (clock changed, edited data) is shown as a date, never as "Hace -1 días".
  if (diff < 0) return shortDate(iso)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff} días`
  return shortDate(iso)
}

export type Tone = 'up' | 'down' | 'hold' | 'ai'

export function toneFor(mode: PrescriptionMode): Tone {
  switch (mode) {
    case 'subir':
      return 'up'
    case 'bajar':
    case 'regreso':
      return 'down'
    case 'calibracion':
    case 'ajuste':
      return 'ai'
    default:
      return 'hold'
  }
}

export function chipText(mode: PrescriptionMode, delta: number): string {
  if (mode === 'calibracion') return 'Calibrar'
  if (delta > 0) return `+${kg(delta)} kg`
  if (delta < 0) return `−${kg(Math.abs(delta))} kg`
  if (mode === 'repetir') return 'Repetir'
  return '+1 rep'
}

export function setsText(log: ExerciseLog): string {
  const done = log.sets.filter((s) => s.done)
  if (done.length === 0) return ''
  const sameWeight = done.every((s) => s.weight === done[0].weight)
  if (sameWeight) {
    const w = done[0].weight
    return `${w > 0 ? `${kg(w)} kg × ` : ''}${done.map((s) => s.reps).join(', ')}`
  }
  return done.map((s) => `${kg(s.weight)}×${s.reps}`).join(', ')
}

/** Monday-based start of week, local time. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

export function sessionsThisWeek(sessions: Session[], now = new Date()): number {
  const start = weekStart(now).getTime()
  return sessions.filter((s) => new Date(s.date).getTime() >= start).length
}

/** Sessions in the week that starts on `start` (Monday). */
export function sessionsInWeek(sessions: Session[], start: Date): number {
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return sessions.filter((s) => {
    const t = new Date(s.date).getTime()
    return t >= start.getTime() && t < end.getTime()
  }).length
}

/**
 * Weeks in a row with at least `target` sessions, counting back from this week.
 * The current week only adds once it is met; while it is in progress it does not break the streak.
 */
export function weekStreak(sessions: Session[], target: number, now = new Date()): number {
  if (target <= 0 || sessions.length === 0) return 0
  const earliest = sessions.reduce((min, s) => Math.min(min, new Date(s.date).getTime()), Infinity)
  const week = weekStart(now)
  let streak = sessionsInWeek(sessions, week) >= target ? 1 : 0
  for (;;) {
    week.setDate(week.getDate() - 7)
    const end = new Date(week)
    end.setDate(end.getDate() + 7)
    if (end.getTime() <= earliest) break
    if (sessionsInWeek(sessions, week) >= target) streak++
    else break
  }
  return streak
}

/** How a set felt, with the hint shown everywhere the user picks it. */
export const FEEL_OPTIONS: { value: Feel; label: string; hint: string }[] = [
  { value: 'facil', label: 'Fácil', hint: 'Sobraban 3+' },
  { value: 'justo', label: 'Justo', hint: 'Sobraban 1–2' },
  { value: 'limite', label: 'Al límite', hint: 'Ni una más' },
]

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
