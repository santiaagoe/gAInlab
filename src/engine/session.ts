import { historyFor, prescribe } from './progression'
import type { ActiveExercise, ActiveSession, AgeGroup, Plan, PlanDay, PlanExercise, Prescription, Session, SetLog, Settings } from './types'

/**
 * Pure rules for sessions and history: what is saved, how a corrected session is cleaned,
 * which day comes next and how each exercise is prescribed. The store only calls these.
 */

export interface TrainingContext {
  sessions: Session[]
  settings: Settings
  age?: AgeGroup
}

/** Date of the most recent saved session, of any day. */
export function lastTrainedAt(sessions: Session[]): string | undefined {
  let latest: string | undefined
  let latestTime = -Infinity
  for (const s of sessions) {
    const t = new Date(s.date).getTime()
    if (!Number.isNaN(t) && t > latestTime) {
      latestTime = t
      latest = s.date
    }
  }
  return latest
}

/** The single place where a plan entry becomes a prescription, so "Hoy" and the session always agree. */
export function prescriptionFor(ctx: TrainingContext, plan: PlanExercise, now: Date = new Date()): Prescription {
  return prescribe(plan, historyFor(plan.exerciseId, ctx.sessions), ctx.settings, now, ctx.age, lastTrainedAt(ctx.sessions))
}

/** Exercise ready to log, with the sets pre-filled from the prescription. */
export function prepareExercise(ctx: TrainingContext, plan: PlanExercise, exerciseId: string, now: Date = new Date()): ActiveExercise {
  const target = { ...plan, exerciseId }
  const prescription = prescriptionFor(ctx, target, now)
  // In calibration the reps start empty so the user logs what they actually did.
  const calibrating = prescription.mode === 'calibracion'
  const sets: SetLog[] = prescription.reps.map((reps) => ({
    weight: prescription.weight ?? 0,
    reps: calibrating ? 0 : reps,
    done: false,
  }))
  return { plan: target, exerciseId, prescription, sets }
}

/** Saved form of a finished session: only sets marked as done, only exercises with at least one. Null when nothing was done. */
export function toSession(active: ActiveSession, now: Date = new Date()): Session | null {
  const exercises = active.exercises
    .map((ex) => ({ ex, sets: ex.sets.filter((s) => s.done && s.reps > 0) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ ex, sets }) => ({
      exerciseId: ex.exerciseId,
      repMin: ex.plan.repMin,
      repMax: ex.plan.repMax,
      ...(ex.feel ? { feel: ex.feel } : {}),
      ...(ex.prescription.recoverTo !== undefined ? { recoverTo: ex.prescription.recoverTo } : {}),
      sets,
    }))
  if (exercises.length === 0) return null
  return { id: active.id, date: now.toISOString(), dayId: active.dayId, dayName: active.dayName, exercises }
}

/** A corrected past session: sets without reps are dropped, then exercises without sets. Null when nothing is left. */
export function cleanEdited(session: Session): Session | null {
  const exercises = session.exercises
    .map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps > 0) }))
    .filter((e) => e.sets.length > 0)
  return exercises.length === 0 ? null : { ...session, exercises }
}

/**
 * Next day in the rotation: the one after the most recent session whose day still exists in the plan.
 * Sessions of days that were removed are skipped instead of sending the user back to day 1.
 */
export function nextDay(plan: Plan, sessions: Session[]): PlanDay | undefined {
  if (plan.days.length === 0) return undefined
  for (let i = sessions.length - 1; i >= 0; i--) {
    const index = plan.days.findIndex((d) => d.id === sessions[i].dayId)
    if (index >= 0) return plan.days[(index + 1) % plan.days.length]
  }
  return plan.days[0]
}
