import { generatePlan } from './generator'
import { contextFor, doseFor } from './targets'
import type { Exercise, Plan, PlanExercise, Profile, Role } from './types'

/** Plan for a survey, built by the rules engine (src/engine/generator.ts). */
export function buildPlan(profile: Profile): Plan {
  return generatePlan(profile).plan
}

/** Default sets for an exercise the person adds by hand. */
const ADDED_SETS = 3

/** Plan entry for an exercise the user adds by hand: compounds as secondary work, the rest as accessories. */
export function entryFor(profile: Profile, exercise: Exercise): PlanExercise {
  const ctx = contextFor(profile)
  const role: Role = exercise.compound ? 'secundario' : 'accesorio'
  const dose = doseFor(ctx, exercise)
  return {
    exerciseId: exercise.id,
    slot: exercise.slot,
    role,
    sets: Math.min(ADDED_SETS, ctx.maxSetsPerExercise),
    repMin: dose.repMin,
    repMax: dose.repMax,
    rest: dose.rest,
    rir: dose.rir,
  }
}
