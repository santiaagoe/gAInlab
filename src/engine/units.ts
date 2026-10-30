/** Number formatting shared by the engine and the interface. */

/** "52,5" */
export function kg(value: number): string {
  return value.toLocaleString('es-CL', { maximumFractionDigits: 2 })
}

/** "52,5 kg" */
export function formatKg(value: number): string {
  return `${kg(value)} kg`
}

/** "1:05" from seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const DAY_MS = 86_400_000

/** Whole calendar days from `from` to `to` in local time, so the hour of the day never changes the count. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((start(to) - start(from)) / DAY_MS)
}
