import { ageRules } from './age'
import { isFreeBarbell } from './exercises'
import {
  AGE_DOC,
  CORE_SETS,
  REDUCED_RIR,
  REP_LIMITS,
  REST,
  SELECTION,
  SESSION_CAP,
  SPLITS,
  STRENGTH_DAY_CAP,
  STRENGTH_MAIN_SETS,
  SUPERSET_MAX,
  SUPERSET_REST,
  WEEKLY_SETS,
  approachSets,
  repRule,
  type DayKind,
  type Range,
  type RestRule,
} from './rules'
import type { Exercise, Experience, Goal, Muscle, Profile } from './types'

/**
 * Everything the generator and the validation need to know about one person, with the age adjustments of
 * section 11 merged with src/engine/age.ts: when both set the same thing, the more conservative value wins.
 */
export interface Context {
  profile: Profile
  goal: Goal
  experience: Experience
  /** Row of table 1a: under-18s always use "Nuevo". */
  volumeExperience: Experience
  /** Weekly fractional sets per muscle (1a, core from table 6), already adjusted for age. */
  volume: Record<Muscle, Range>
  sessionCap: number
  requestedDays: number
  /** Strength days after the cap of table 5a (and the under-18 limit). */
  days: number
  split: { name: string; days: DayKind[] }
  maxSetsPerExercise: number
  /** Cap for the main exercise of the day. */
  mainSets: number
  exercisesPerSession: number
  exercisesPerMuscle: number
  approach: number
  minReps: number
  minRir: number
  extraRest: number
  freeBarbell: boolean
  supersets: boolean | 'maquina'
  supersetMax: number
  recoveryHours: number
}

export interface Options {
  /** Cap strength days by experience (table 5a). Defaults to true. */
  capStrengthDays?: boolean
}

const MUSCLE_LIST: Muscle[] = [
  'cuadriceps',
  'gluteo',
  'femoral',
  'gemelo',
  'pecho',
  'espalda',
  'deltAnterior',
  'deltLateral',
  'deltPosterior',
  'biceps',
  'triceps',
  'core',
]

export function contextFor(profile: Profile, options: Options = {}): Context {
  const goal = profile.goal
  const experience = profile.experience
  const doc = profile.age ? AGE_DOC[profile.age] : AGE_DOC['30-39']
  const legacy = ageRules(profile.age)
  const volumeExperience: Experience = doc.volumeAsNew ? 'nuevo' : experience

  const base = WEEKLY_SETS[goal][volumeExperience]
  const range: Range = {
    min: base.min,
    def: doc.startAtMin ? base.min : base.def,
    max: doc.maxIsDefault ? base.def : base.max,
  }
  const volume = {} as Record<Muscle, Range>
  for (const m of MUSCLE_LIST) volume[m] = m === 'core' ? { min: CORE_SETS.min, def: CORE_SETS.def, max: CORE_SETS.max } : { ...range }

  const requestedDays = Math.min(6, Math.max(2, Math.round(profile.days)))
  let days = requestedDays
  if (options.capStrengthDays !== false) days = Math.min(days, STRENGTH_DAY_CAP[experience])
  if (doc.maxDays) days = Math.min(days, doc.maxDays)
  days = Math.max(2, days)

  const maxSetsPerExercise = Math.min(SELECTION.setsPerExercise.max, doc.maxSetsPerExercise ?? SELECTION.setsPerExercise.max)
  const mainCap = goal === 'fuerza' ? STRENGTH_MAIN_SETS[experience] : SELECTION.setsPerExercise.max
  const mainSets = Math.min(mainCap, maxSetsPerExercise, legacy.maxMainSets)

  const isNew = experience === 'nuevo'
  const docMinReps = (isNew ? doc.minRepsNew : undefined) ?? doc.minReps ?? 0
  const docMinRir = (isNew ? doc.minRirNew : undefined) ?? doc.minRir ?? 0

  // Free barbell: never for beginners (7b); age can forbid it too (11b).
  let freeBarbell = !isNew
  if (doc.freeBarbell === false) freeBarbell = false
  if (doc.freeBarbell === 'mas1' && experience !== 'mas1') freeBarbell = false
  if (legacy.preferSafeVariants && experience !== 'mas1') freeBarbell = false

  return {
    profile,
    goal,
    experience,
    volumeExperience,
    volume,
    sessionCap: SESSION_CAP[goal][experience],
    requestedDays,
    days,
    split: SPLITS[days],
    maxSetsPerExercise,
    mainSets,
    exercisesPerSession: SELECTION.exercisesPerSession[experience],
    exercisesPerMuscle: SELECTION.exercisesPerMuscle[experience],
    approach: approachSets(goal, experience),
    minReps: Math.max(legacy.minReps, docMinReps),
    minRir: Math.max(isNew ? REP_LIMITS.newMinRir : 0, docMinRir),
    extraRest: Math.max(legacy.extraRest, doc.extraRest),
    freeBarbell,
    supersets: doc.supersets,
    supersetMax: SUPERSET_MAX[experience],
    recoveryHours: doc.recoveryHours ?? 48,
  }
}

export interface Dose {
  repMin: number
  repMax: number
  rir: number
  rest: number
}

/** Allowed rep range for an exercise: table 3, raised to the age minimum and kept inside the hard limits. */
export function repRange(ctx: Context, exercise: Exercise): { min: number; max: number } {
  const compound = exercise.compound
  const rule = repRule(ctx.goal, ctx.experience, compound)
  const limits = compound ? REP_LIMITS.compound : REP_LIMITS.isolation
  let min = Math.max(rule.min, limits.min)
  let max = Math.min(rule.max, limits.max)
  if (min < ctx.minReps) {
    const width = max - min
    min = Math.min(ctx.minReps, limits.max)
    max = Math.min(limits.max, Math.max(max, min + width))
  }
  return { min, max }
}

/** Target RIR: table 3, never below the hard limits, the beginner and age minimums. */
export function rirFor(ctx: Context, exercise: Exercise, reduced = false): number {
  let rir = repRule(ctx.goal, ctx.experience, exercise.compound).rir
  if (reduced) rir = Math.min(rir, REDUCED_RIR)
  if (exercise.compound) rir = Math.max(rir, REP_LIMITS.compound.minRir)
  if (isFreeBarbell(exercise)) rir = Math.max(rir, 1)
  // RIR 0 only on machines or cables with > 1 year.
  if (rir === 0 && !(exercise.kind === 'maquina' && ctx.experience === 'mas1')) rir = 1
  return Math.max(rir, ctx.minRir)
}

/** Rest range of table 4a (or the superset row), moved up by the extra rest for age. */
export function restRange(ctx: Context, exercise: Exercise, superset = false): RestRule {
  const table = superset ? SUPERSET_REST : REST[ctx.goal]
  const r = exercise.compound ? table.compound : table.isolation
  return { def: r.def + ctx.extraRest, min: r.min + ctx.extraRest, max: r.max + ctx.extraRest }
}

export function doseFor(ctx: Context, exercise: Exercise, reduced = false): Dose {
  const reps = repRange(ctx, exercise)
  return { repMin: reps.min, repMax: reps.max, rir: rirFor(ctx, exercise, reduced), rest: restRange(ctx, exercise).def }
}
