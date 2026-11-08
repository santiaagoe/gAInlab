import { generatePlan } from './generator'
import { contextFor, doseFor, type Options } from './targets'
import type { Exercise, Plan, PlanExercise, Profile, Role, Settings } from './types'

/** Engine options from the app settings. */
export function engineOptions(settings?: Pick<Settings, 'capStrengthDays'>): Options {
  return { capStrengthDays: settings?.capStrengthDays !== false }
}

/** Plan for a survey, built by the rules engine (src/engine/generator.ts). */
export function buildPlan(profile: Profile, options: Options = {}): Plan {
  return generatePlan(profile, options).plan
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
