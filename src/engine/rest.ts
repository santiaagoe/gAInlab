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

/** Seconds to change station between the two exercises of a superset. */
export const SUPERSET_SWITCH = 15

export interface SupersetStep {
  /** Index of the other exercise of the pair. */
  partner: number
  /** True: go to the partner now with a short switch; false: the round is done, normal rest. */
  switchNow: boolean
  rest: number
  label: string
}

/**
 * Supersets (table 8b): one set of each exercise in turn, resting only after each round. Called after marking
 * `setIndex` of `exercises[index]`; returns null when the exercise is not in a superset or its partner is done.
 */
export function supersetStep(exercises: ActiveExercise[], index: number, setIndex: number, partnerName: (i: number) => string): SupersetStep | null {
  const ex = exercises[index]
  const letter = ex?.plan.superset
  if (!letter) return null
  const partner = exercises.findIndex((e, i) => i !== index && e.plan.superset === letter)
  if (partner < 0) return null
  const other = exercises[partner]
  const pending = other.sets.filter((s) => !s.done).length
  if (pending === 0) return null
  const doneHere = ex.sets.filter((s, j) => s.done || j === setIndex).length
  const doneThere = other.sets.length - pending
  if (doneThere < doneHere) {
    return { partner, switchNow: true, rest: SUPERSET_SWITCH, label: `Ahora: ${partnerName(partner)}` }
  }
  return { partner, switchNow: false, rest: ex.plan.rest, label: 'Descanso entre rondas' }
}
