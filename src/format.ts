import type { ExerciseLog, PrescriptionMode, Session } from './engine/types'

export function kg(value: number): string {
  return value.toLocaleString('es-CL', { maximumFractionDigits: 2 })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000)
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
