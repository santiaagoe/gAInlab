import { ageSummary } from './age'
import { belowMinimum, coverageOf, modeOf, ratiosOf, type Coverage, type PlanMode } from './coverage'
import { sessionMinutes, type TimedExercise } from './duration'
import { contributions, EXERCISES, isFreeBarbell, MUSCLE_NAMES, MUSCLES } from './exercises'
import {
  ANTAGONISTS,
  CORE_SETS,
  DAY_MUSCLES,
  DAY_PATTERNS,
  DURATION,
  MIN_DIRECT_SETS_IN_SESSION,
  RATIOS,
  REDUCED_FLOOR,
  REDUCED_ORDER,
  REQUIRED_PATTERNS,
  SELECTION,
  TRIM,
  type DayKind,
  type RestRule,
} from './rules'
import { contextFor, doseFor, restRange, rirFor, type Context, type Options } from './targets'
import type { CoreType, Exercise, Muscle, Pattern, Plan, PlanDay, PlanExercise, Profile, Role } from './types'

/* ---------- Result ---------- */

export interface DayReport {
  id: string
  /** Estimated minutes with formula 4b. */
  minutes: number
  /** True when the time limit forced cuts on this day (rule 9 lower bound applies). */
  trimmed: boolean
}

export interface Suggestion {
  /** One more training day would reach a complete plan. */
  addDay: boolean
  /** 15 more minutes per session would reach a complete plan. */
  addMinutes: boolean
}

export interface GeneratedPlan {
  plan: Plan
  mode: PlanMode
  /** Muscles below the minimum of table 1a (shown in the warning). */
  belowMin: Muscle[]
  /** Required patterns with no exercise for this equipment and these injuries. */
  missingPatterns: Pattern[]
  /** Only when the plan is not complete. */
  suggestion: Suggestion | null
  /** Days the person chose beyond the strength-day cap: rest or cardio. */
  restDays: number
  days: DayReport[]
  context: Context
}

/* ---------- Internal state ---------- */

interface Entry {
  ex: Exercise
  sets: number
  superset?: string
}

interface Day {
  kind: DayKind
  entries: Entry[]
  warmup: number
  approach: number
  /** Rest lowered towards the low end of table 4a, in quarters (0 = default, 4 = lowest allowed). */
  restCut: number
  /** Sets were cut for time (steps 4–6 of table 8a). */
  trimmed: boolean
}

interface State {
  ctx: Context
  days: Day[]
}

type FloorFn = (m: Muscle) => number

const FILL_ORDER: Muscle[] = [
  'cuadriceps',
  'femoral',
  'pecho',
  'espalda',
  'deltAnterior',
  'gluteo',
  'deltLateral',
  'deltPosterior',
  'gemelo',
  'biceps',
  'triceps',
  'core',
]

/** Which compound leads the day (table 5c, priority 2 for strength). */
const MAIN_PRIORITY: Pattern[] = ['sentadilla', 'empujeH', 'bisagra', 'tironV', 'empujeV', 'tironH', 'hipThrust']

const BIG: Muscle[] = ['cuadriceps', 'gluteo', 'femoral', 'espalda', 'pecho']
const UPPER: Muscle[] = ['pecho', 'espalda', 'deltAnterior', 'deltLateral', 'deltPosterior', 'biceps', 'triceps']
const LOWER: Muscle[] = ['cuadriceps', 'gluteo', 'femoral', 'gemelo']

/** Three full-body days: each pattern twice, four compounds per day (decision: A/B/C). */
const THREE_DAY: Record<string, number[]> = {
  sentadilla: [0, 1],
  empujeH: [0, 1],
  tironV: [0, 2],
  bisagra: [0, 2],
  empujeV: [1, 2],
  tironH: [1, 2],
}

const PRIMARY = new WeakMap<Exercise, Muscle | null>()

function primaryOf(ex: Exercise): Muscle | undefined {
  let p = PRIMARY.get(ex)
  if (p === undefined) {
    const c = contributions(ex)
    p = MUSCLES.find((m) => c[m] === 1) ?? null
    PRIMARY.set(ex, p)
  }
  return p ?? undefined
}

function isIsolation(ex: Exercise): boolean {
  return ex.pattern === 'aislamiento' || ex.pattern === 'core'
}

/* ---------- Choosing exercises ---------- */

function allowed(ctx: Context, ex: Exercise): boolean {
  if (ex.legacy || ex.hold || ex.custom || ex.unknown) return false
  if (!ex.equip.includes(ctx.profile.equipment)) return false
  if (ex.avoid?.some((i) => ctx.profile.injuries.includes(i))) return false
  if (!ctx.freeBarbell && isFreeBarbell(ex)) return false
  return true
}

/** Library order, with bilateral compounds first (7a) and the barbell first for strength > 1 year (7b). */
function ranked(ctx: Context, filter: (ex: Exercise) => boolean): Exercise[] {
  const strengthBar = ctx.goal === 'fuerza' && ctx.experience === 'mas1'
  const key = (e: Exercise) => (e.unilateral ? 2 : 0) + (strengthBar && e.compound && e.kind !== 'barra' ? 1 : 0)
  return EXERCISES.filter((e) => allowed(ctx, e) && filter(e))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => key(a.e) - key(b.e) || a.i - b.i)
    .map((x) => x.e)
}

/** Candidate lists depend only on the person, so they are worked out once per context. */
const CANDIDATES = new WeakMap<Context, Map<string, Exercise[]>>()

function cached(ctx: Context, key: string, make: () => Exercise[]): Exercise[] {
  let map = CANDIDATES.get(ctx)
  if (!map) CANDIDATES.set(ctx, (map = new Map()))
  let list = map.get(key)
  if (!list) map.set(key, (list = make()))
  return list
}

function compoundsFor(ctx: Context, pattern: Pattern): Exercise[] {
  return cached(ctx, `p:${pattern}`, () => ranked(ctx, (e) => e.pattern === pattern))
}

function isolationsFor(ctx: Context, muscle: Muscle): Exercise[] {
  if (muscle === 'core') return cached(ctx, 'i:core', () => ranked(ctx, (e) => e.pattern === 'core'))
  return cached(ctx, `i:${muscle}`, () => ranked(ctx, (e) => e.pattern === 'aislamiento' && e.muscles?.[0] === muscle))
}

/** Days that get each required pattern. */
function patternDays(ctx: Context, available: Set<Pattern>): Map<Pattern, number[]> {
  const kinds = ctx.split.days
  const out = new Map<Pattern, number[]>()
  for (const p of REQUIRED_PATTERNS) {
    if (!available.has(p)) continue
    let days: number[]
    if (kinds.length === 3) days = [...THREE_DAY[p]]
    else days = kinds.map((k, i) => (DAY_PATTERNS[k].includes(p) ? i : -1)).filter((i) => i >= 0)
    out.set(p, days)
  }
  // Strength > 1 year: the main patterns three times a week when the days allow it (table 2).
  if (ctx.goal === 'fuerza' && ctx.experience === 'mas1' && kinds.length === 3) {
    for (const p of ['sentadilla', 'empujeH'] as Pattern[]) out.get(p)?.splice(0, 3, 0, 1, 2)
  }
  // One exercise per muscle and session for beginners: never both pulls on the same day.
  if (ctx.exercisesPerMuscle === 1) {
    const h = out.get('tironH')
    const v = out.get('tironV')
    if (h && v) {
      for (let d = 0; d < kinds.length; d++) {
        if (!h.includes(d) || !v.includes(d)) continue
        if (h.length >= v.length) h.splice(h.indexOf(d), 1)
        else v.splice(v.indexOf(d), 1)
      }
    }
  }
  return out
}

/* ---------- Counting ---------- */

function cover(state: State): Coverage {
  return coverageOf(state.days.map((d) => ({ exercises: d.entries.map((e) => ({ exerciseId: e.ex.id, sets: e.sets, ex: e.ex })) })))
}

/** The day's main exercise: its compound with the highest priority (table 5c). */
function mainOf(day: Day): Entry | undefined {
  let best: Entry | undefined
  for (const e of day.entries) {
    if (isIsolation(e.ex)) continue
    if (!best || MAIN_PRIORITY.indexOf(e.ex.pattern) < MAIN_PRIORITY.indexOf(best.ex.pattern)) best = e
  }
  return best
}

function maxSetsOf(ctx: Context, e: Entry, day?: Day): number {
  return day && mainOf(day) === e ? ctx.mainSets : ctx.maxSetsPerExercise
}

function primaryCount(day: Day, m: Muscle): number {
  return day.entries.filter((e) => primaryOf(e.ex) === m).length
}

/**
 * Everything the plan must keep true while it grows or shrinks. An operation is accepted only when it adds no
 * new item to this list: that way a cut never breaks a rule that already held.
 */
type Issues = Map<string, number>

/** How far a value is outside [min, max]; a ratio with nothing below the line counts as the worst case. */
function outside(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return WORST
  return Math.min(WORST, v < min - 1e-9 ? min - v : v > max + 1e-9 ? v - max : 0)
}

const WORST = 10

function issues(state: State, floor: FloorFn, known?: Coverage): Issues {
  const { ctx } = state
  const c = known ?? cover(state)
  const out: Issues = new Map()
  const add = (key: string, amount: number) => amount > 1e-9 && out.set(key, amount)
  for (const m of MUSCLES) {
    add(`floor:${m}`, floor(m) - c.weekly[m])
    add(`max:${m}`, c.weekly[m] - ctx.volume[m].max)
    // Rule 3. In reduced mode, muscles whose floor is 0 (9b) may drop to any volume and are listed in the warning.
    const counts = floor(m) > 0 ? c.weekly[m] > 0 : c.weekly[m] >= ctx.volume[m].min
    if (m !== 'core' && counts && c.frequency[m] < 2) add(`freq:${m}`, 1)
    c.perDay.forEach((day, d) => add(`cap:${d}:${m}`, day[m] - ctx.sessionCap))
  }
  // Core in two sessions with two types (table 6), unless reduced mode lets it go (floor 0).
  if (floor('core') > 0) {
    add('core:sessions', CORE_SETS.minSessions - c.coreDays)
    add('core:types', CORE_SETS.minTypes - c.coreTypes.size)
  }
  for (const p of REQUIRED_PATTERNS) if (c.patternCount[p] === 0) add(`pattern:${p}`, 1)
  // Squat, horizontal push and pulling: twice a week (table 9b).
  add('twice:sentadilla', 2 - c.patternCount.sentadilla)
  add('twice:empujeH', 2 - c.patternCount.empujeH)
  add('twice:tiron', 2 - c.patternCount.tironH - c.patternCount.tironV)
  const r = ratiosOf(c)
  const hv = RATIOS.horizontalVertical
  add('ratio:pullPush', outside(r.pullPush, RATIOS.pullPush.min, RATIOS.pullPush.max))
  add('ratio:pushHV', outside(r.pushHV, hv.min, hv.max))
  add('ratio:pullHV', outside(r.pullHV, hv.min, hv.max))
  add('ratio:quadHam', outside(r.quadHam, RATIOS.quadHam.min, RATIOS.quadHam.max))
  add('ratio:rearFront', outside(r.rearFront, RATIOS.rearFront.min, Infinity))
  return out
}

/** No new issue, and none got worse. */
function noWorse(after: Issues, before: Issues): boolean {
  for (const [key, amount] of after) {
    const was = before.get(key)
    if (was === undefined || amount > was + 1e-9) return false
  }
  return true
}

/** Runs `op`; keeps it only if no issue is new or worse (and `extra` holds). Returns whether it was kept. */
function attempt(state: State, floor: FloorFn, op: () => void, extra: () => boolean = () => true, known?: Issues): boolean {
  const before = known ?? issues(state, floor)
  const snapshot = state.days.map((d) => ({ ...d, entries: d.entries.map((e) => ({ ...e })) }))
  op()
  if (extra() && noWorse(issues(state, floor), before)) return true
  state.days = snapshot
  return false
}

/* ---------- Growing the plan ---------- */

function fitsCaps(state: State, d: number, ex: Exercise, sets: number, c: Coverage): boolean {
  const contrib = contributions(ex)
  for (const m of MUSCLES) {
    const v = contrib[m]
    if (!v) continue
    if (c.weekly[m] + v * sets > state.ctx.volume[m].max + 1e-9) return false
    if (c.perDay[d][m] + v * sets > state.ctx.sessionCap + 1e-9) return false
  }
  return true
}

function canCreate(state: State, d: number, ex: Exercise, c: Coverage): boolean {
  const day = state.days[d]
  const { ctx } = state
  if (day.entries.length >= ctx.exercisesPerSession) return false
  if (day.entries.some((e) => e.ex.id === ex.id)) return false
  const primary = primaryOf(ex)
  if (primary && !DAY_MUSCLES[day.kind].includes(primary)) return false
  if (primary && primaryCount(day, primary) >= ctx.exercisesPerMuscle) return false
  return fitsCaps(state, d, ex, MIN_DIRECT_SETS_IN_SESSION, c)
}

/** Days for a new entry of this muscle: days without it first, then the least loaded. */
function daysFor(state: State, m: Muscle, c: Coverage): number[] {
  return state.days
    .map((day, d) => ({ d, day }))
    .filter(({ day }) => DAY_MUSCLES[day.kind].includes(m))
    .sort(
      (a, b) =>
        primaryCount(a.day, m) - primaryCount(b.day, m) ||
        c.perDay[a.d][m] - c.perDay[b.d][m] ||
        a.day.entries.length - b.day.entries.length ||
        a.d - b.d,
    )
    .map((x) => x.d)
}

/** Ways to add a new exercise for a muscle, in order of preference. */
function newOptions(ctx: Context, m: Muscle): Exercise[] {
  return cached(ctx, `n:${m}`, () => newOptionsUncached(ctx, m))
}

function newOptionsUncached(ctx: Context, m: Muscle): Exercise[] {
  switch (m) {
    case 'espalda':
      return [...compoundsFor(ctx, 'tironH'), ...compoundsFor(ctx, 'tironV')]
    case 'pecho':
      return compoundsFor(ctx, 'empujeH')
    case 'deltAnterior':
      return compoundsFor(ctx, 'empujeV')
    case 'cuadriceps':
      return [...isolationsFor(ctx, 'cuadriceps'), ...compoundsFor(ctx, 'sentadilla')]
    case 'femoral':
      return [...isolationsFor(ctx, 'femoral'), ...compoundsFor(ctx, 'bisagra')]
    case 'gluteo':
      return compoundsFor(ctx, 'hipThrust')
    default:
      return isolationsFor(ctx, m)
  }
}

function coreTypeOf(e: Entry): CoreType | undefined {
  return e.ex.coreType
}

/** A change to the plan and the day it lengthens. */
interface Op {
  days: number[]
  apply: () => void
}

/** Ways to create a new entry (2 sets) for the muscle, best day first. */
function createOps(state: State, m: Muscle, c: Coverage, only?: number[], pattern?: Pattern): Op[] {
  const options = newOptions(state.ctx, m).filter((e) => !pattern || e.pattern === pattern)
  const usedCore = new Set(state.days.flatMap((d) => d.entries.map(coreTypeOf)).filter(Boolean))
  const ops: Op[] = []
  for (const d of daysFor(state, m, c)) {
    if (only && !only.includes(d)) continue
    let list = options
    // Core: first an anti-extension exercise, then anti-rotation or lateral (table 6).
    if (m === 'core') {
      const wanted: CoreType[] = usedCore.has('antiExtension') ? ['antiRotacion', 'lateral'] : ['antiExtension']
      list = [...options.filter((e) => e.coreType && wanted.includes(e.coreType)), ...options]
    }
    const pick = list.find((ex) => canCreate(state, d, ex, c))
    if (pick) ops.push({ days: [d], apply: () => state.days[d].entries.push({ ex: pick, sets: MIN_DIRECT_SETS_IN_SESSION }) })
  }
  // A muscle with no work at all gets two exercises on different days at once (rule 3: twice a week).
  if (m !== 'core' && c.frequency[m] === 0 && ops.length >= 2) {
    const [a, b] = ops
    ops.unshift({ days: [...a.days, ...b.days], apply: () => (a.apply(), b.apply()) })
  }
  return ops
}

function createFor(state: State, m: Muscle, c: Coverage, only?: number[]): boolean {
  const op = createOps(state, m, c, only)[0]
  if (!op) return false
  op.apply()
  return true
}

function bump(state: State, d: number, id: string): Op {
  return {
    days: [d],
    apply: () => {
      const e = state.days[d].entries.find((x) => x.ex.id === id)
      if (e) e.sets++
    },
  }
}

/**
 * Ways to add one set for a muscle, best first: one more set of an exercise that trains it directly, a new
 * exercise, or (while under the 1a minimum) one more set of a compound that trains it indirectly.
 */
function setOps(state: State, m: Muscle, pattern?: Pattern, known?: Coverage): Op[] {
  const c = known ?? cover(state)
  const direct: { d: number; e: Entry }[] = []
  const indirect: { d: number; e: Entry }[] = []
  state.days.forEach((day, d) =>
    day.entries.forEach((e) => {
      const v = contributions(e.ex)[m]
      if (!v || (pattern && e.ex.pattern !== pattern)) return
      if (e.sets + 1 > maxSetsOf(state.ctx, e, day) || !fitsCaps(state, d, e.ex, 1, c)) return
      if (v === 1) direct.push({ d, e })
      else indirect.push({ d, e })
    }),
  )
  // Femorales: keep knee flexion and hip hinge level (table 6).
  const typeSets = (e: Entry) =>
    m === 'femoral' ? (e.ex.pattern === 'bisagra' ? c.patternSets.bisagra : c.direct.femoral - c.patternSets.bisagra) : 0
  direct.sort((a, b) => typeSets(a.e) - typeSets(b.e) || c.perDay[a.d][m] - c.perDay[b.d][m] || a.e.sets - b.e.sets || a.d - b.d)
  // Core: more sets only once it is in two sessions with two types of exercise (table 6); before that, new ones.
  const spread = m !== 'core' || (c.coreDays >= CORE_SETS.minSessions && c.coreTypes.size >= CORE_SETS.minTypes)
  const ops = spread ? direct.map(({ d, e }) => bump(state, d, e.ex.id)) : []
  ops.push(...createOps(state, m, c, undefined, pattern))
  if (pattern) return ops
  if (c.weekly[m] < state.ctx.volume[m].min) {
    indirect.sort((a, b) => a.e.sets - b.e.sets || a.d - b.d)
    ops.push(...indirect.map(({ d, e }) => bump(state, d, e.ex.id)))
  }
  return ops
}

/** Adds one set for the muscle with the first possible option (no time check). */
function addSetFor(state: State, m: Muscle, pattern?: Pattern, known?: Coverage): boolean {
  const op = setOps(state, m, pattern, known)[0]
  if (!op) return false
  op.apply()
  return true
}

function targetOf(ctx: Context, m: Muscle): number {
  return m === 'core' ? CORE_SETS.def : ctx.volume[m].def
}

function fill(state: State) {
  for (let guard = 0; guard < 400; guard++) {
    const c = cover(state)
    const next = FILL_ORDER.find((m) => c.weekly[m] < targetOf(state.ctx, m) && addSetFor(state, m, undefined, c))
    if (!next) break
  }
}

/** What each proportion of table 6 needs when it is out of range: muscle (and pattern) to add to. */
function balanceNeeds(c: Coverage): [Muscle, Pattern?][] {
  const r = ratiosOf(c)
  const needs: [Muscle, Pattern?][] = []
  if (r.rearFront < RATIOS.rearFront.min) needs.push(['deltPosterior'], ['espalda', 'tironH'])
  if (r.pullPush < RATIOS.pullPush.min) needs.push(['espalda', 'tironH'], ['espalda'], ['biceps'], ['deltPosterior'])
  if (c.patternSets.empujeV > 0 && r.pushHV > RATIOS.horizontalVertical.max) needs.push(['deltAnterior', 'empujeV'])
  if (c.patternSets.empujeV > 0 && r.pushHV < RATIOS.horizontalVertical.min) needs.push(['pecho', 'empujeH'])
  if (c.patternSets.tironV > 0 && r.pullHV > RATIOS.horizontalVertical.max) needs.push(['espalda', 'tironV'])
  if (c.patternSets.tironV > 0 && r.pullHV < RATIOS.horizontalVertical.min) needs.push(['espalda', 'tironH'])
  if (c.direct.femoral > 0 && r.quadHam < RATIOS.quadHam.min) needs.push(['cuadriceps'])
  if (c.direct.femoral > 0 && r.quadHam > RATIOS.quadHam.max) needs.push(['femoral'])
  return needs
}

/** Brings the proportions of table 6 into range by adding sets where they are short. */
function balance(state: State) {
  for (let guard = 0; guard < 200; guard++) {
    if (!balanceNeeds(cover(state)).some(([m, p]) => addSetFor(state, m, p))) break
  }
}

/**
 * Adds one set for the muscle with the first option that adds no new issue and keeps every day within its
 * minutes. Marks the days where an option was turned down only because of time.
 */
function growSet(state: State, m: Muscle, floor: FloorFn, timeBound: Set<number>, pattern?: Pattern, c: Coverage = cover(state)): boolean {
  const known = issues(state, floor, c)
  for (const op of setOps(state, m, pattern, c)) {
    let late = false
    const ok = attempt(
      state,
      floor,
      op.apply,
      () => {
        late = op.days.some((d) => !fits(state, d))
        return !late
      },
      known,
    )
    if (ok) return true
    if (late) op.days.forEach((d) => timeBound.add(d))
  }
  return false
}

/** Grows the plan in priority order, level by level, while it fits in time (used for reduced mode and to refill). */
function grow(state: State, order: Muscle[], levels: ((m: Muscle) => number)[], floor: FloorFn, timeBound: Set<number>) {
  for (const level of levels) {
    for (let guard = 0; guard < 300; guard++) {
      const c = cover(state)
      const needs = balanceNeeds(c)
      if (needs.some(([m, p]) => growSet(state, m, floor, timeBound, p, c))) continue
      if (!order.some((m) => c.weekly[m] < level(m) && growSet(state, m, floor, timeBound, undefined, c))) break
    }
  }
}

/* ---------- Order, supersets and time ---------- */

function groupOf(e: Entry): number {
  if (e.ex.compound && !isIsolation(e.ex)) return 0
  const p = primaryOf(e.ex)
  return p === 'gemelo' || p === 'core' ? 2 : 1
}

const KIND_DEMAND: Record<Exercise['kind'], number> = { barra: 0, mancuerna: 1, corporal: 1, maquina: 2 }

/** Table 5c: compounds first (main lift first in strength), more technical first, big muscles first, core and calves last. */
function orderEntries(ctx: Context, entries: Entry[], main?: Entry): Entry[] {
  const units: Entry[][] = []
  const seen = new Set<Entry>()
  for (const e of entries) {
    if (seen.has(e)) continue
    const partner = e.superset ? entries.find((x) => x !== e && x.superset === e.superset) : undefined
    const unit = partner ? [e, partner] : [e]
    unit.forEach((x) => seen.add(x))
    units.push(unit)
  }
  const strength = ctx.goal === 'fuerza'
  const key = (u: Entry[]) => {
    const g = Math.max(...u.map(groupOf))
    const lead = u[0]
    const big = BIG.includes(primaryOf(lead.ex) ?? 'core') ? 0 : 1
    return [g, strength && u.includes(main as Entry) ? 0 : 1, g === 0 ? KIND_DEMAND[lead.ex.kind] : 0, big, groupOf(lead) === 2 && primaryOf(lead.ex) === 'core' ? 1 : 0]
  }
  const indexed = units.map((u, i) => ({ u, i, k: key(u) }))
  indexed.sort((a, b) => {
    for (let j = 0; j < a.k.length; j++) if (a.k[j] !== b.k[j]) return a.k[j] - b.k[j]
    return a.i - b.i
  })
  return indexed.flatMap((x) => x.u)
}

const DOSES = new WeakMap<Context, Map<Exercise, { repMax: number; rest: RestRule; superset: RestRule }>>()

/** Reps and rest ranges per exercise, worked out once per context (the time estimate asks for them often). */
function cachedDose(ctx: Context, ex: Exercise) {
  let map = DOSES.get(ctx)
  if (!map) DOSES.set(ctx, (map = new Map()))
  let d = map.get(ex)
  if (!d) map.set(ex, (d = { repMax: doseFor(ctx, ex).repMax, rest: restRange(ctx, ex), superset: restRange(ctx, ex, true) }))
  return d
}

function restOf(state: State, day: Day, e: Entry): number {
  const { ctx } = state
  const dose = cachedDose(ctx, e.ex)
  if (e.superset) return dose.superset.def
  const r = dose.rest
  if (day.restCut === 0) return r.def
  const floor = e.ex.compound ? (ctx.goal === 'fuerza' ? TRIM.minRest.strengthCompound : TRIM.minRest.compound) : TRIM.minRest.isolation
  const low = Math.min(r.def, Math.max(r.min, floor + ctx.extraRest))
  return Math.round((r.def - ((r.def - low) * day.restCut) / REST_STEPS) / 5) * 5
}

function timed(state: State, day: Day): TimedExercise[] {
  const ordered = orderEntries(state.ctx, day.entries, mainOf(day))
  const seen = new Set<Pattern>()
  return ordered.map((e) => {
    let approach = 0
    if (e.ex.compound && !isIsolation(e.ex) && !seen.has(e.ex.pattern)) {
      seen.add(e.ex.pattern)
      approach = day.approach
    }
    const dose = cachedDose(state.ctx, e.ex)
    return { sets: e.sets, reps: dose.repMax, rest: restOf(state, day, e), unilateral: e.ex.unilateral, approach, superset: e.superset }
  })
}

function minutesOf(state: State, d: number): number {
  const day = state.days[d]
  return sessionMinutes(timed(state, day), day.warmup)
}

function fits(state: State, d: number): boolean {
  return minutesOf(state, d) <= state.ctx.profile.minutes + 1e-9
}

function supersetAllowed(ctx: Context, a: Exercise, b: Exercise): boolean {
  if (ctx.supersets === false) return false
  for (const ex of [a, b]) {
    if (ex.pattern !== 'aislamiento' || ex.hold) return false
    if (ctx.experience === 'nuevo' && !['maquina', 'mancuerna'].includes(ex.kind)) return false
    if (ctx.supersets === 'maquina' && ex.kind !== 'maquina') return false
  }
  const pa = primaryOf(a)
  const pb = primaryOf(b)
  if (!pa || !pb || pa === pb) return false
  const antagonist = ANTAGONISTS.some(([x, y]) => (x === pa && y === pb) || (x === pb && y === pa))
  if (ctx.supersets === 'maquina') return antagonist
  const alternate = (UPPER.includes(pa) && LOWER.includes(pb)) || (LOWER.includes(pa) && UPPER.includes(pb))
  return antagonist || alternate
}

/** Step 2 of table 8a: pairs isolation exercises into safe supersets (table 8b). */
function makeSupersets(state: State, day: Day) {
  const letters = ['A', 'B', 'C', 'D']
  let count = day.entries.filter((e) => e.superset).length / 2
  const free = () => day.entries.filter((e) => !e.superset)
  for (const a of free()) {
    if (count >= state.ctx.supersetMax) break
    if (a.superset) continue
    const b = free().find((x) => x !== a && supersetAllowed(state.ctx, a.ex, x.ex))
    if (!b) continue
    const letter = letters.find((l) => !day.entries.some((e) => e.superset === l))!
    a.superset = letter
    b.superset = letter
    count++
  }
}

/** Removes one set from an entry, or the entry itself when it is at the minimum of 2 sets. */
function shrink(day: Day, e: Entry) {
  if (e.sets > SELECTION.setsPerExercise.min) {
    e.sets--
    return
  }
  day.entries = day.entries.filter((x) => x !== e)
  if (e.superset) day.entries.forEach((x) => (x.superset === e.superset ? delete x.superset : undefined))
}

/** Tries to cut one set on day d from the entries matching `match`, in the given order. */
function cutOne(state: State, d: number, floor: FloorFn, match: (e: Entry) => boolean, order: (a: Entry, b: Entry) => number): boolean {
  const list = state.days[d].entries.filter(match).sort(order)
  for (const target of list) {
    const id = target.ex.id
    const ok = attempt(state, floor, () => {
      const day = state.days[d]
      const e = day.entries.find((x) => x.ex.id === id)
      if (e) shrink(day, e)
    })
    if (ok) return true
  }
  return false
}

const laterFirst = (day: Day) => (a: Entry, b: Entry) => day.entries.indexOf(b) - day.entries.indexOf(a)

function minFloorOf(ctx: Context): FloorFn {
  return (m) => (m === 'core' ? CORE_SETS.min : ctx.volume[m].min)
}

const REST_STEPS = 4

/**
 * Steps 1–3 of table 8a: shorter warm-up and one approach set, supersets of isolation exercises, rest lowered step
 * by step towards the low end. With `all`, everything at once (reduced mode, before cutting volume).
 */
function quickTrims(state: State, d: number, all = false) {
  const day = state.days[d]
  day.warmup = TRIM.warmup
  day.approach = TRIM.approachSets
  if (!all && fits(state, d)) return
  makeSupersets(state, day)
  for (let step = 1; step <= REST_STEPS; step++) {
    if (!all && fits(state, d)) return
    day.restCut = step
  }
}

/** Gives back rest, supersets, warm-up and approach sets (reverse order of 8a) while the day still fits. */
function relax(state: State, d: number) {
  const day = state.days[d]
  const keep = (undo: () => void, redo: () => void) => {
    undo()
    if (fits(state, d)) return true
    redo()
    return false
  }
  for (let changed = true; changed; ) {
    changed = false
    if (day.restCut > 0 && keep(() => day.restCut--, () => day.restCut++)) changed = true
    for (const letter of [...new Set(day.entries.map((e) => e.superset).filter(Boolean))]) {
      const pair = day.entries.filter((e) => e.superset === letter)
      const undo = () => pair.forEach((e) => delete e.superset)
      const redo = () => pair.forEach((e) => (e.superset = letter))
      if (keep(undo, redo)) changed = true
    }
    if (day.warmup < DURATION.warmup && keep(() => day.warmup++, () => day.warmup--)) changed = true
    if (day.approach < state.ctx.approach && keep(() => day.approach++, () => day.approach--)) changed = true
  }
}

/** True when the day gave up something to fit in time. */
function cutForTime(state: State, d: number): boolean {
  const day = state.days[d]
  return day.trimmed || day.restCut > 0 || day.warmup < DURATION.warmup || day.approach < state.ctx.approach || day.entries.some((e) => e.superset)
}

/** Fits day d into the minutes chosen with steps 1–6 of table 8a, never below the 1a minimum. */
function fitDay(state: State, d: number) {
  const { ctx } = state
  const day = () => state.days[d]
  if (fits(state, d)) return
  const minFloor = minFloorOf(ctx)
  // 1–3.
  quickTrims(state, d)
  if (fits(state, d)) return
  // 4. Direct work for muscles already trained indirectly, down to the 1a minimum.
  day().trimmed = true
  while (!fits(state, d) && cutOne(state, d, minFloor, (e) => isIsolation(e.ex) && TRIM.indirectlyCovered.includes(primaryOf(e.ex)!), laterFirst(day()))) {
    /* keep cutting */
  }
  // 5. Every muscle down towards the 1a minimum, taking first from the one with the most room above it.
  while (!fits(state, d)) {
    const c = cover(state)
    const slack = (e: Entry) => {
      const p = primaryOf(e.ex)
      return p ? (c.weekly[p] - minFloor(p)) / Math.max(1, ctx.volume[p].def - minFloor(p)) : 0
    }
    if (!cutOne(state, d, minFloor, () => true, (a, b) => slack(b) - slack(a) || b.sets - a.sets || laterFirst(day())(a, b))) break
  }
  // 6. Unilateral exercises to bilateral ones.
  for (const e of day().entries.filter((x) => x.ex.unilateral)) {
    if (fits(state, d)) break
    const alt = [...compoundsFor(ctx, e.ex.pattern), ...isolationsFor(ctx, primaryOf(e.ex)!)].find(
      (x) => !x.unilateral && x.pattern === e.ex.pattern && primaryOf(x) === primaryOf(e.ex) && !day().entries.some((y) => y.ex.id === x.id),
    )
    if (alt) e.ex = alt
  }
}

/* ---------- Builders ---------- */

function newState(ctx: Context): State {
  return {
    ctx,
    days: ctx.split.days.map((kind) => ({ kind, entries: [], warmup: DURATION.warmup, approach: ctx.approach, restCut: 0, trimmed: false })),
  }
}

/** Places compounds: every occurrence from patternDays, or (minimal) just what reduced mode keeps (9a, 9b). */
function seedCompounds(state: State, available: Set<Pattern>, minimal: boolean) {
  const { ctx } = state
  const plan = patternDays(ctx, available)
  if (minimal) {
    // Squat, horizontal push and hinge twice (frequency of their muscles), one horizontal and one vertical pull on
    // different days, one vertical push on the least busy day.
    const keep = (p: Pattern, n: number) => plan.has(p) && plan.set(p, plan.get(p)!.slice(0, n))
    keep('sentadilla', 2)
    keep('empujeH', 2)
    keep('bisagra', 2)
    // Without one of the pulls, the other one twice (frequency of the back).
    const both = plan.has('tironH') && plan.has('tironV')
    keep('tironH', both ? 1 : 2)
    const h = plan.get('tironH')?.[0]
    const v = plan.get('tironV')
    if (v) plan.set('tironV', both ? [v.find((d) => d !== h) ?? v[0]] : v.slice(0, 2))
  }
  for (const [pattern, days] of plan) {
    if (minimal && pattern === 'empujeV') continue
    placeCompound(state, pattern, days)
  }
  if (minimal && plan.has('empujeV')) {
    const best = [...plan.get('empujeV')!].sort((a, b) => state.days[a].entries.length - state.days[b].entries.length || a - b)[0]
    placeCompound(state, 'empujeV', [best])
  }
}

function placeCompound(state: State, pattern: Pattern, days: number[]) {
  const { ctx } = state
  const all = compoundsFor(ctx, pattern)
  // Vary only among bilateral exercises (7a); one side at a time only when there is nothing else.
  const bilateral = all.filter((e) => !e.unilateral)
  const options = bilateral.length > 0 ? bilateral : all
  days.forEach((d, k) => {
    const day = state.days[d]
    // Strength: repeat the same lift (the strength gained is specific to it). Otherwise vary between days.
    const start = ctx.goal === 'fuerza' ? 0 : k % options.length
    const rotated = [...options.slice(start), ...options.slice(0, start)]
    const pick = rotated.find((ex) => !day.entries.some((e) => e.ex.id === ex.id))
    if (pick) day.entries.push({ ex: pick, sets: MIN_DIRECT_SETS_IN_SESSION })
  })
}

/** Isolation that tables 7a and 6 ask for: core (2 types, 2 days), knee flexion, rear and side delts, calves twice. */
function seedIsolation(state: State) {
  const seeds: Muscle[] = ['core', 'core', 'femoral', 'deltPosterior', 'deltLateral', 'gemelo', 'gemelo']
  const seeded = new Map<Muscle, number[]>()
  for (const m of seeds) {
    const used = seeded.get(m) ?? []
    const freeDays = state.days.map((_, d) => d).filter((d) => !used.includes(d))
    const before = state.days.map((d) => d.entries.length)
    if (createFor(state, m, cover(state), freeDays)) {
      seeded.set(m, [...used, state.days.findIndex((day, i) => day.entries.length > before[i])])
    }
  }
}

/** Complete plan: default volume of 1a, then the cuts of table 8a (steps 1–6) where time is short. */
function buildComplete(ctx: Context, available: Set<Pattern>): State {
  const state = newState(ctx)
  seedCompounds(state, available, false)
  seedIsolation(state)
  fill(state)
  balance(state)
  state.days.forEach((_, d) => fitDay(state, d))
  // Give back the time the cuts left over (rule 9: not much shorter than the minutes chosen).
  grow(state, FILL_ORDER, [(m) => targetOf(ctx, m)], minFloorOf(ctx), new Set())
  state.days.forEach((_, d) => relax(state, d))
  return state
}

/** Muscles each pattern step of table 9a stands for. */
const PATTERN_MAIN: Partial<Record<Pattern, Muscle[]>> = {
  bisagra: ['femoral', 'gluteo'],
  tironV: ['espalda'],
  empujeV: ['deltAnterior'],
}

/**
 * Growth order in reduced mode: what is never cut (squat, horizontal push, pulling), then the reverse of the
 * cutting order of table 9a.
 */
const REDUCED_GROWTH: Muscle[] = [
  ...new Set<Muscle>([
    'cuadriceps',
    'pecho',
    'espalda',
    ...[...REDUCED_ORDER].reverse().flatMap((s) => (s.kind === 'isolation' ? [s.muscle] : s.patterns.flatMap((p) => PATTERN_MAIN[p] ?? []))),
  ]),
]

/**
 * Reduced plan (section 9): starts from what is never cut and grows in the reverse order of table 9a, first up to
 * the floor of 9b, then to the 1a minimum, then to the default, while every day fits. Days that run out of time get
 * steps 1–3 of table 8a and grow again.
 */
function buildReduced(ctx: Context, available: Set<Pattern>): State {
  const state = newState(ctx)
  seedCompounds(state, available, true)
  const floor: FloorFn = (m) => REDUCED_FLOOR[m]
  // Warm-up and rest give way before volume does (table 8a, steps 1–3); relax() gives back what is left over.
  state.days.forEach((_, d) => quickTrims(state, d, true))
  // Levels: floor of 9b (core 2 if it fits), minimum of 1a (core in two sessions, table 6), default.
  const minimum = minFloorOf(ctx)
  const levels = [
    (m: Muscle) => (m === 'core' ? CORE_SETS.min : REDUCED_FLOOR[m]),
    (m: Muscle) => (m === 'core' ? CORE_SETS.def : minimum(m)),
    (m: Muscle) => targetOf(ctx, m),
  ]
  const timeBound = new Set<number>()
  grow(state, REDUCED_GROWTH, levels, floor, timeBound)
  state.days.forEach((day) => makeSupersets(state, day))
  grow(state, REDUCED_GROWTH, levels, floor, timeBound)
  // Last resort before giving up volume: no general warm-up (step 1 allows 0–2 min).
  if (timeBound.size > 0) {
    timeBound.forEach((d) => (state.days[d].warmup = TRIM.minWarmup))
    grow(state, REDUCED_GROWTH, levels, floor, new Set())
  }
  // Insufficient: not even the floor (9b, with the proportions of table 6) fits. It is still completed, longer
  // than chosen, and the plan says so.
  const c = cover(state)
  const shortOfFloor = MUSCLES.some((m) => c.weekly[m] < REDUCED_FLOOR[m]) || balanceNeeds(c).length > 0
  if (shortOfFloor) {
    state.days.forEach((_, d) => quickTrims(state, d, true))
    for (let guard = 0; guard < 100; guard++) {
      const c = cover(state)
      const known = issues(state, floor, c)
      const tryOps = (m: Muscle, p?: Pattern) => setOps(state, m, p, c).some((op) => attempt(state, floor, op.apply, () => true, known))
      const short = REDUCED_GROWTH.some((m) => c.weekly[m] < REDUCED_FLOOR[m] && tryOps(m))
      if (!short && !balanceNeeds(c).some(([m, p]) => tryOps(m, p))) break
    }
  }
  state.days.forEach((_, d) => relax(state, d))
  return state
}

/**
 * Lower is better: [over time, rules broken, mode, muscles under the 1a minimum]. A broken validation rule weighs
 * more than the spread of core work (table 6), which is not one of the 17 rules.
 */
function rank(state: State): number[] {
  const c = cover(state)
  const over = state.days.some((_, d) => !fits(state, d)) ? 1 : 0
  const mode = modeOf(state.ctx, c)
  const floor: FloorFn = mode === 'completo' ? minFloorOf(state.ctx) : (m) => REDUCED_FLOOR[m]
  let broken = 0
  for (const key of issues(state, floor, c).keys()) broken += key.startsWith('core:') ? 1 : 10
  return [over, broken, mode === 'completo' ? 0 : mode === 'reducido' ? 1 : 2, belowMinimum(state.ctx, c).length]
}

function better(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/* ---------- Text ---------- */

const DAY_NAMES: Record<DayKind, string> = {
  completo: 'Cuerpo completo',
  torso: 'Torso',
  pierna: 'Pierna',
  empuje: 'Empuje',
  tiron: 'Tirón',
}

const GOAL_TEXT: Record<Profile['goal'], string> = {
  hipertrofia: 'Pensado para ganar músculo: todos los grupos musculares reciben trabajo dos veces por semana.',
  grasa: 'Pensado para mantener la fuerza y el músculo mientras bajas de peso: pesos exigentes en los básicos y volumen moderado.',
  fuerza: 'Pensado para ganar fuerza: los básicos van primero, con menos repeticiones y descansos largos.',
  salud: 'Volumen moderado para entrenar con constancia: cubre todo el cuerpo sin agotarte.',
}

export const PATTERN_NAMES: Record<Pattern, string> = {
  sentadilla: 'sentadilla o prensa',
  bisagra: 'bisagra de cadera',
  empujeH: 'empuje horizontal',
  empujeV: 'empuje vertical',
  tironH: 'remo',
  tironV: 'tirón vertical',
  hipThrust: 'hip thrust',
  aislamiento: 'aislamiento',
  core: 'core',
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function summaryFor(ctx: Context, mode: PlanMode, belowMin: Muscle[], missing: Pattern[], restDays: number): string {
  const p = ctx.profile
  const parts = [GOAL_TEXT[p.goal]]
  if (mode === 'reducido') {
    parts.push(
      `Con ${p.days} días de ${p.minutes} minutos armamos una versión reducida: ${listNames(belowMin.map((m) => MUSCLE_NAMES[m]))} quedan bajo el volumen recomendado.`,
    )
  }
  if (mode === 'insuficiente') {
    parts.push(
      `Ni la versión mínima cabe en ${p.minutes} minutos: cada sesión dura algo más. Si puedes, suma un día o unos minutos.`,
    )
  }
  if (restDays > 0) {
    parts.push(
      restDays === 1
        ? 'El día que sobra es para descansar o hacer cardio suave.'
        : `Los ${restDays} días que sobran son para descansar o hacer cardio suave.`,
    )
  }
  if (p.situation === 'regreso') parts.push('Como vuelves de una pausa, la primera sesión de cada ejercicio sirve para calibrar con pesos cómodos.')
  if (p.injuries.length > 0) parts.push('Evitamos los ejercicios que suelen cargar las zonas donde tienes molestias.')
  if (missing.length > 0) {
    parts.push(`Con tu equipo y tus molestias no hay un ejercicio seguro de ${listNames(missing.map((m) => PATTERN_NAMES[m]))}; un profesional puede ayudarte a buscar una alternativa.`)
  }
  const age = ageSummary(p.age)
  if (age) parts.push(age)
  if (p.age === 'menor') parts.push('Lo ideal son 3 días no consecutivos.')
  if ((p.age === '60-69' || p.age === '70+') && p.experience === 'nuevo') {
    parts.push('Si recién empiezas, conviene que un profesional te acompañe las primeras sesiones.')
  }
  return parts.join(' ')
}

/* ---------- Entry point ---------- */

interface GenerateOptions extends Options {
  /** Internal: skip the +1 day / +15 min check. */
  suggest?: boolean
}

export function generatePlan(profile: Profile, options: GenerateOptions = {}): GeneratedPlan {
  const ctx = contextFor(profile, options)
  const available = new Set(REQUIRED_PATTERNS.filter((p) => compoundsFor(ctx, p).length > 0))
  const missingPatterns = REQUIRED_PATTERNS.filter((p) => !available.has(p))

  // Complete plan cut with table 8a; if it does not reach the 1a minimums, a reduced plan grown from the floor.
  let state = buildComplete(ctx, available)
  const first = rank(state)
  if (first.some((x) => x > 0)) {
    const reduced = buildReduced(ctx, available)
    if (better(rank(reduced), first)) state = reduced
  }

  // Result.
  const c = cover(state)
  let mode = modeOf(ctx, c)
  const overTime = state.days.some((_, d) => !fits(state, d))
  if (overTime) mode = 'insuficiente'
  const reduced = mode !== 'completo'
  const belowMin = belowMinimum(ctx, c)

  const letters = 'ABC'
  const kindCount = new Map<DayKind, number>()
  const planDays: PlanDay[] = state.days.map((day, i) => {
    const n = kindCount.get(day.kind) ?? 0
    kindCount.set(day.kind, n + 1)
    const repeats = ctx.split.days.filter((k) => k === day.kind).length > 1
    const ordered = orderEntries(ctx, day.entries, mainOf(day))
    const firstCompound = ordered.find((e) => !isIsolation(e.ex))
    const exercises: PlanExercise[] = ordered.map((e) => {
      const dose = doseFor(ctx, e.ex, reduced)
      const role: Role = e === firstCompound ? 'principal' : isIsolation(e.ex) ? 'accesorio' : 'secundario'
      const out: PlanExercise = {
        exerciseId: e.ex.id,
        slot: e.ex.slot,
        role,
        sets: e.sets,
        repMin: dose.repMin,
        repMax: dose.repMax,
        rest: restOf(state, day, e),
        rir: rirFor(ctx, e.ex, reduced),
      }
      if (e.superset) out.superset = e.superset
      return out
    })
    const compounds = ordered.filter((e) => !isIsolation(e.ex)).slice(0, 2).map((e) => e.ex.name)
    return {
      id: `d${i + 1}`,
      name: repeats ? `${DAY_NAMES[day.kind]} ${letters[n]}` : DAY_NAMES[day.kind],
      focus: listNames(compounds),
      exercises,
    }
  })

  const restDays = ctx.requestedDays - ctx.days
  const plan: Plan = {
    name: ctx.split.name,
    summary: summaryFor(ctx, mode, belowMin, missingPatterns, restDays),
    days: planDays,
  }

  let suggestion: Suggestion | null = null
  if (mode !== 'completo' && options.suggest !== false) {
    const more = (p: Profile) => generatePlan(p, { ...options, suggest: false }).mode === 'completo'
    const nextDays = contextFor({ ...profile, days: ctx.requestedDays + 1 }, options).days
    suggestion = {
      addDay: ctx.requestedDays < 6 && nextDays > ctx.days && more({ ...profile, days: ctx.requestedDays + 1 }),
      addMinutes: profile.minutes + 15 <= 90 && more({ ...profile, minutes: profile.minutes + 15 }),
    }
  }

  return {
    plan,
    mode,
    belowMin,
    missingPatterns,
    suggestion,
    restDays,
    days: state.days.map((_, i) => ({ id: `d${i + 1}`, minutes: Math.round(minutesOf(state, i) * 10) / 10, trimmed: cutForTime(state, i) })),
    context: ctx,
  }
}
