import { contributions, getExercise, MUSCLES } from './exercises'
import { CORE_SETS, PULL_MUSCLES, PUSH_MUSCLES, REDUCED_FLOOR, REQUIRED_PATTERNS } from './rules'
import type { Context } from './targets'
import type { CoreType, Exercise, Muscle, Pattern, Plan } from './types'

/** How a plan covers each muscle and pattern in a week, counted with the fractional method (table 1b). */
export interface Coverage {
  /** Fractional sets per muscle and week. */
  weekly: Record<Muscle, number>
  /** Fractional sets per muscle in each day, in plan order. */
  perDay: Record<Muscle, number>[]
  /** Direct sets (contribution 1) per muscle in each day. */
  directPerDay: Record<Muscle, number>[]
  /** Direct sets per muscle and week. */
  direct: Record<Muscle, number>
  /** Days that give the muscle any work (direct or indirect). */
  frequency: Record<Muscle, number>
  /** Sets per pattern and week. */
  patternSets: Record<Pattern, number>
  /** Exercises per pattern and week. */
  patternCount: Record<Pattern, number>
  coreTypes: Set<CoreType>
  /** Days with direct core work. */
  coreDays: number
  /** Knee flexion exercises (isolation with femorales as the target). */
  kneeFlexion: number
}

const PATTERNS: Pattern[] = ['sentadilla', 'bisagra', 'empujeH', 'empujeV', 'tironH', 'tironV', 'hipThrust', 'aislamiento', 'core']
/** Muscles a set of the exercise counts for, with their share (cached per exercise). */
const SHARES = new WeakMap<Exercise, [Muscle, number][]>()
function sharesOf(ex: Exercise): [Muscle, number][] {
  let list = SHARES.get(ex)
  if (!list) {
    const c = contributions(ex)
    list = MUSCLES.filter((m) => c[m]).map((m) => [m, c[m]!] as [Muscle, number])
    SHARES.set(ex, list)
  }
  return list
}

/** A record with every muscle at 0 (same shape every time, which keeps it fast). */
function zeros(): Record<Muscle, number> {
  return {
    cuadriceps: 0,
    gluteo: 0,
    femoral: 0,
    gemelo: 0,
    pecho: 0,
    espalda: 0,
    deltAnterior: 0,
    deltLateral: 0,
    deltPosterior: 0,
    biceps: 0,
    triceps: 0,
    core: 0,
  }
}

/** The part of a plan the counting needs. */
export interface CountedDay {
  exercises: { exerciseId: string; sets: number; ex?: Exercise }[]
}

export function coverageOf(days: CountedDay[]): Coverage {
  const weekly = zeros()
  const direct = zeros()
  const frequency = zeros()
  const patternSets = {} as Record<Pattern, number>
  const patternCount = {} as Record<Pattern, number>
  for (const p of PATTERNS) {
    patternSets[p] = 0
    patternCount[p] = 0
  }
  const coreTypes = new Set<CoreType>()
  let coreDays = 0
  let kneeFlexion = 0
  const perDay: Record<Muscle, number>[] = []
  const directPerDay: Record<Muscle, number>[] = []

  for (const day of days) {
    const today = zeros()
    const todayDirect = zeros()
    for (const entry of day.exercises) {
      const ex = entry.ex ?? getExercise(entry.exerciseId)
      if (ex.unknown) continue
      patternSets[ex.pattern] += entry.sets
      patternCount[ex.pattern]++
      if (ex.coreType) coreTypes.add(ex.coreType)
      if (ex.pattern === 'aislamiento' && ex.muscles?.[0] === 'femoral') kneeFlexion++
      for (const [m, v] of sharesOf(ex)) {
        today[m] += v * entry.sets
        if (v === 1) todayDirect[m] += entry.sets
      }
    }
    for (const m of MUSCLES) {
      if (today[m] === 0) continue
      weekly[m] += today[m]
      direct[m] += todayDirect[m]
      frequency[m]++
    }
    if (todayDirect.core > 0) coreDays++
    perDay.push(today)
    directPerDay.push(todayDirect)
  }
  return { weekly, perDay, directPerDay, direct, frequency, patternSets, patternCount, coreTypes, coreDays, kneeFlexion }
}

export interface Ratios {
  pullPush: number
  pushHV: number
  pullHV: number
  quadHam: number
  rearFront: number
}

function ratio(a: number, b: number): number {
  if (b === 0) return a === 0 ? 1 : Infinity
  return a / b
}

/** Proportions of table 6. Pull:push uses the fractional sets of the pulling and pushing muscles. */
export function ratiosOf(c: Coverage): Ratios {
  const sum = (list: Muscle[]) => list.reduce((s, m) => s + c.weekly[m], 0)
  return {
    pullPush: ratio(sum(PULL_MUSCLES), sum(PUSH_MUSCLES)),
    pushHV: ratio(c.patternSets.empujeH, c.patternSets.empujeV),
    pullHV: ratio(c.patternSets.tironH, c.patternSets.tironV),
    quadHam: ratio(c.direct.cuadriceps, c.direct.femoral),
    rearFront: ratio(c.weekly.deltPosterior, c.weekly.deltAnterior),
  }
}

export type PlanMode = 'completo' | 'reducido' | 'insuficiente'

/** Lowest weekly sets for a complete plan: table 1a, and 2 direct sets for core (table 6). */
export function minimumFor(ctx: Context, m: Muscle): number {
  return m === 'core' ? CORE_SETS.min : ctx.volume[m].min
}

/** Muscles below the minimum of table 1a. */
export function belowMinimum(ctx: Context, c: Coverage): Muscle[] {
  return MUSCLES.filter((m) => c.weekly[m] < minimumFor(ctx, m))
}

/** Mode a plan reaches by volume: complete (1a), reduced (floor of 9b) or insufficient. */
export function modeOf(ctx: Context, c: Coverage): PlanMode {
  if (MUSCLES.some((m) => c.weekly[m] < REDUCED_FLOOR[m])) return 'insuficiente'
  return belowMinimum(ctx, c).length === 0 ? 'completo' : 'reducido'
}

export interface CoverageReview {
  mode: PlanMode
  /** Muscles below the minimum of table 1a. */
  belowMin: Muscle[]
  /** Muscles above the maximum of table 1a. */
  aboveMax: Muscle[]
  /** Muscles trained fewer than twice a week (core excluded). */
  lowFrequency: Muscle[]
  /** Required patterns with no exercise in the week. */
  missingPatterns: Pattern[]
  weekly: Record<Muscle, number>
}

/** Checks any plan, also one the person built or edited, against the volume rules. */
export function reviewPlan(ctx: Context, plan: Plan): CoverageReview {
  const c = coverageOf(plan.days)
  return {
    mode: modeOf(ctx, c),
    belowMin: belowMinimum(ctx, c),
    aboveMax: MUSCLES.filter((m) => c.weekly[m] > ctx.volume[m].max),
    lowFrequency: MUSCLES.filter((m) => m !== 'core' && c.frequency[m] < 2),
    missingPatterns: REQUIRED_PATTERNS.filter((p) => c.patternCount[p] === 0),
    weekly: c.weekly,
  }
}
