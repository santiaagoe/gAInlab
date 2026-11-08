import { DURATION } from './rules'

/** What the duration formula needs from each exercise of a session. */
export interface TimedExercise {
  sets: number
  /** Reps per set; the generator uses the top of the range so the estimate errs long. */
  reps: number
  /** Rest between sets, or between rounds in a superset (seconds). */
  rest: number
  unilateral?: boolean
  /** Approach sets before the first compound of each pattern. */
  approach: number
  /** Exercises with the same letter are a superset. */
  superset?: string
}

/** One working set, in seconds: 3 s per rep plus 10 s to get ready, twice for one side at a time (table 4b). */
export function setSeconds(e: TimedExercise): number {
  return (DURATION.secondsPerRep * e.reps + DURATION.setupPerSet) * (e.unilateral ? DURATION.unilateralFactor : 1)
}

/** Seconds for one exercise done on its own: sets, rest between them, approach sets and the change to the next. */
export function exerciseSeconds(e: TimedExercise): number {
  return e.sets * setSeconds(e) + Math.max(0, e.sets - 1) * e.rest + e.approach * DURATION.approachSet + DURATION.transition
}

/**
 * Seconds for a superset: both exercises' sets back to back, one rest per round and a single change of station.
 * With equal sets this is roughly half of doing them one after the other (table 8b).
 */
export function supersetSeconds(a: TimedExercise, b: TimedExercise): number {
  const rounds = Math.max(a.sets, b.sets)
  const rest = Math.max(a.rest, b.rest)
  return (
    a.sets * setSeconds(a) +
    b.sets * setSeconds(b) +
    Math.max(0, rounds - 1) * rest +
    (a.approach + b.approach) * DURATION.approachSet +
    DURATION.transition
  )
}

/** Estimated minutes for a session (formula 4b), with the general warm-up in minutes. */
export function sessionMinutes(exercises: TimedExercise[], warmup: number = DURATION.warmup): number {
  let seconds = 0
  const done = new Set<number>()
  exercises.forEach((e, i) => {
    if (done.has(i)) return
    if (e.superset) {
      const j = exercises.findIndex((x, k) => k !== i && !done.has(k) && x.superset === e.superset)
      if (j >= 0) {
        seconds += supersetSeconds(e, exercises[j])
        done.add(i).add(j)
        return
      }
    }
    seconds += exerciseSeconds(e)
    done.add(i)
  })
  return warmup + seconds / 60
}
