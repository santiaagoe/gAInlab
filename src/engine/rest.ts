import type { ActiveExercise, RestState } from './types'

/**
 * Rules for the rest between sets. The timer stores when the rest ends instead of counting down,
 * so the time is right after the phone pauses or closes the app in the background.
 */

/** A late alert is worse than none: if the rest ended longer ago than this (the app was in the background), stay quiet. */
export const ALERT_WINDOW_MS = 3000

export function startRest(seconds: number, label: string, now: number = Date.now()): RestState {
  return { endsAt: now + seconds * 1000, total: seconds, label }
}

export function extendRest(rest: RestState, seconds: number): RestState {
  return { ...rest, endsAt: rest.endsAt + seconds * 1000, total: rest.total + seconds }
}

/** Seconds left, negative once the rest is over. */
export function restLeft(rest: RestState, now: number = Date.now()): number {
  return Math.round((rest.endsAt - now) / 1000)
}

/** True right when the rest ends, but not when the user comes back to the app long after it ended. */
export function shouldAlert(rest: RestState, now: number = Date.now()): boolean {
  const past = now - rest.endsAt
  return past >= -500 && past <= ALERT_WINDOW_MS
}

/** Text under the timer after marking `setIndex` of `ex` as done. */
export function restLabel(ex: ActiveExercise, setIndex: number, hasNextExercise: boolean): string {
  const remaining = ex.sets.filter((s, j) => j !== setIndex && !s.done).length
  if (remaining > 0) return `Descanso, ${remaining === 1 ? 'falta 1 serie' : `faltan ${remaining} series`}`
  return hasNextExercise ? 'Ejercicio listo' : 'Última serie lista'
}

/** A set can be marked once it has reps and, unless the exercise is bodyweight, a weight. */
export function canMark(weight: number, reps: number, bodyweight: boolean): boolean {
  return reps > 0 && (bodyweight || weight > 0)
}

/**
 * After the user types the reps of a set and leaves the field, the set is marked and the rest starts by itself.
 * Only for the set that comes next and only when the reps were actually changed, so filling in sets ahead
 * or tapping a field by mistake never marks anything.
 */
export function shouldAutoMark(ex: ActiveExercise, setIndex: number, repsChanged: boolean, bodyweight: boolean): boolean {
  if (!repsChanged) return false
  const set = ex.sets[setIndex]
  if (!set || set.done) return false
  if (ex.sets.findIndex((s) => !s.done) !== setIndex) return false
  return canMark(set.weight, set.reps, bodyweight)
}
