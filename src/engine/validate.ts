import { coverageOf, minimumFor, ratiosOf } from './coverage'
import { contributions, EXERCISES, getExercise, isFreeBarbell, MUSCLES } from './exercises'
import type { GeneratedPlan } from './generator'
import {
  ANTAGONISTS,
  RATIOS,
  RECOVERY_HOURS,
  REDUCED_FLOOR,
  REP_LIMITS,
  REQUIRED_PATTERNS,
  SELECTION,
  STRENGTH_DAY_CAP,
  WEEK_LAYOUT,
} from './rules'
import { repRange, restRange, type Context } from './targets'
import type { Exercise, Muscle, Pattern } from './types'

/**
 * The 17 validation rules of docs/reglas-entrenamiento.md as code. Each check returns the problems it found;
 * an empty list means the plan passes. The tests run this over every survey combination.
 */
export interface Violation {
  rule: number
  message: string
}

function primaryOf(ex: Exercise): Muscle | undefined {
  const c = contributions(ex)
  return MUSCLES.find((m) => c[m] === 1)
}

const isIsolation = (ex: Exercise) => ex.pattern === 'aislamiento' || ex.pattern === 'core'

/** True when no exercise of the pattern fits this person (equipment, injuries, barbell rules). */
export function patternUnavailable(ctx: Context, pattern: Pattern): boolean {
  return !EXERCISES.some(
    (e) =>
      e.pattern === pattern &&
      !e.legacy &&
      !e.hold &&
      e.equip.includes(ctx.profile.equipment) &&
      !e.avoid?.some((i) => ctx.profile.injuries.includes(i)) &&
      (ctx.freeBarbell || !isFreeBarbell(e)),
  )
}

export function validatePlan(result: GeneratedPlan): Violation[] {
  const { plan, context: ctx, mode, belowMin } = result
  const out: Violation[] = []
  const fail = (rule: number, message: string) => out.push({ rule, message })
  const c = coverageOf(plan.days)
  const reduced = mode !== 'completo'
  const fmt = (n: number) => Math.round(n * 100) / 100

  // 1. Volume between the minimum and the maximum of 1a; reduced: under the max and the warning lists exactly
  //    the muscles under the minimum.
  for (const m of MUSCLES) {
    const v = c.weekly[m]
    if (v > ctx.volume[m].max + 1e-9) fail(1, `${m}: ${fmt(v)} series > máximo ${ctx.volume[m].max}`)
    if (!reduced && v < minimumFor(ctx, m)) fail(1, `${m}: ${fmt(v)} series < mínimo ${minimumFor(ctx, m)} en modo completo`)
  }
  const under = MUSCLES.filter((m) => c.weekly[m] < minimumFor(ctx, m))
  if (under.join() !== [...belowMin].join()) fail(1, `aviso [${belowMin.join(', ')}] ≠ músculos bajo el mínimo [${under.join(', ')}]`)

  // 2. Never under the floor of 9b; muscles with floor 0 may be at 0 only in reduced mode and in the warning.
  for (const m of MUSCLES) {
    if (c.weekly[m] < REDUCED_FLOOR[m]) fail(2, `${m}: ${fmt(c.weekly[m])} < piso ${REDUCED_FLOOR[m]}`)
    if (c.weekly[m] === 0 && (!reduced || !belowMin.includes(m))) fail(2, `${m} en 0 sin estar en el aviso`)
  }

  // 3. Every muscle but core trained at least twice a week. Reduced mode: muscles with floor 0 listed in the
  //    warning are exempt (agreed exception, same as rules 1, 2 and 9).
  for (const m of MUSCLES) {
    if (m === 'core') continue
    const exempt = reduced && REDUCED_FLOOR[m] === 0 && belowMin.includes(m)
    if (!exempt && c.frequency[m] < 2) fail(3, `${m}: ${c.frequency[m]} sesiones por semana`)
  }

  // 4. Session cap of table 2.
  c.perDay.forEach((day, i) => {
    for (const m of MUSCLES) if (day[m] > ctx.sessionCap + 1e-9) fail(4, `día ${i + 1}, ${m}: ${fmt(day[m])} > tope ${ctx.sessionCap}`)
  })

  plan.days.forEach((day) => {
    const where = day.name
    // 15. Beginners: at most 6 exercises (and every level its own limit of 7a).
    if (day.exercises.length > ctx.exercisesPerSession) fail(15, `${where}: ${day.exercises.length} ejercicios > ${ctx.exercisesPerSession}`)

    let firstIsolation = -1
    let lastCompound = -1
    let firstTail = -1
    day.exercises.forEach((e, i) => {
      const ex = getExercise(e.exerciseId)
      const name = `${where}, ${ex.name}`
      const compound = !isIsolation(ex)
      if (compound) lastCompound = i
      else if (firstIsolation < 0) firstIsolation = i
      const tail = ['gemelo', 'core'].includes(primaryOf(ex) ?? '')
      if (tail && firstTail < 0) firstTail = i

      // Exercise fits the person.
      if (!ex.equip.includes(ctx.profile.equipment)) fail(13, `${name}: no corresponde al equipo`)
      if (ex.avoid?.some((x) => ctx.profile.injuries.includes(x))) fail(13, `${name}: carga una zona con molestias`)

      // 5. 2–4 sets (5 for the main strength lift), and the stricter caps for age and strength.
      const docMax = ctx.goal === 'fuerza' && e.role === 'principal' ? 5 : SELECTION.setsPerExercise.max
      if (e.sets < SELECTION.setsPerExercise.min || e.sets > docMax) fail(5, `${name}: ${e.sets} series`)
      const cap = e.role === 'principal' ? ctx.mainSets : ctx.maxSetsPerExercise
      if (e.sets > cap) fail(5, `${name}: ${e.sets} series > tope ${cap}`)

      // 6. Reps inside table 3 (moved up by age) and the hard limits.
      const range = repRange(ctx, ex)
      if (e.repMin !== range.min || e.repMax !== range.max) fail(6, `${name}: ${e.repMin}–${e.repMax} ≠ ${range.min}–${range.max}`)
      const limits = ex.compound ? REP_LIMITS.compound : REP_LIMITS.isolation
      if (e.repMin < limits.min || e.repMax > limits.max || e.repMin < 3 || e.repMax > 20 || e.repMin > e.repMax) {
        fail(6, `${name}: ${e.repMin}–${e.repMax} fuera de los límites`)
      }

      // 7. RIR: compounds >= 1, free barbell never 0, beginners >= 2, age minimum.
      const rir = e.rir ?? -1
      if (rir < 0) fail(7, `${name}: sin RIR`)
      if (ex.compound && rir < 1) fail(7, `${name}: RIR ${rir} en compuesto`)
      if (isFreeBarbell(ex) && rir < 1) fail(7, `${name}: RIR 0 con barra`)
      if (ctx.experience === 'nuevo' && rir < 2) fail(7, `${name}: RIR ${rir} para nuevo`)
      if (rir < ctx.minRir) fail(7, `${name}: RIR ${rir} < mínimo por edad ${ctx.minRir}`)

      // 8. Rest inside table 4a (superset row for supersets), moved up by age.
      const rest = restRange(ctx, ex, Boolean(e.superset))
      if (e.rest < rest.min || e.rest > rest.max) fail(8, `${name}: descanso ${e.rest} fuera de ${rest.min}–${rest.max}`)

      // 15. No free barbell for beginners.
      if (ctx.experience === 'nuevo' && isFreeBarbell(ex)) fail(15, `${name}: barra libre para nuevo`)
    })

    // 12. Compounds before isolation; core and calves last.
    if (firstIsolation >= 0 && lastCompound > firstIsolation) fail(12, `${where}: compuesto después de un aislamiento`)
    if (firstTail >= 0) {
      day.exercises.slice(firstTail).forEach((e) => {
        const ex = getExercise(e.exerciseId)
        const tail = ['gemelo', 'core'].includes(primaryOf(ex) ?? '')
        const partner = e.superset && day.exercises.some((x) => x !== e && x.superset === e.superset && ['gemelo', 'core'].includes(primaryOf(getExercise(x.exerciseId)) ?? ''))
        if (!tail && !partner) fail(12, `${where}: ${ex.name} después de core o gemelos`)
      })
    }

    // 16. Safe supersets.
    const groups = new Map<string, Exercise[]>()
    day.exercises.forEach((e) => e.superset && groups.set(e.superset, [...(groups.get(e.superset) ?? []), getExercise(e.exerciseId)]))
    if (groups.size > ctx.supersetMax) fail(16, `${where}: ${groups.size} superseries > ${ctx.supersetMax}`)
    if (groups.size > 0 && ctx.supersets === false) fail(16, `${where}: superserie no permitida por edad`)
    for (const [letter, pair] of groups) {
      if (pair.length !== 2) {
        fail(16, `${where}: superserie ${letter} con ${pair.length} ejercicios`)
        continue
      }
      const [a, b] = pair
      if (primaryOf(a) === primaryOf(b) || (a.pattern === b.pattern && a.pattern !== 'aislamiento')) fail(16, `${where}: superserie del mismo músculo o patrón`)
      for (const x of pair) {
        if (x.compound && isFreeBarbell(x)) fail(16, `${where}: superserie con ${x.name}`)
        if (ctx.supersets === 'maquina' && x.kind !== 'maquina') fail(16, `${where}: superserie fuera de máquina`)
      }
      if (ctx.supersets === 'maquina') {
        const [pa, pb] = [primaryOf(a), primaryOf(b)]
        if (!ANTAGONISTS.some(([x, y]) => (x === pa && y === pb) || (x === pb && y === pa))) fail(16, `${where}: superserie no antagonista`)
      }
    }
  })

  // 9. Duration within the minutes; days that had to be cut: not much shorter than the minutes.
  result.days.forEach((day) => {
    const limit = ctx.profile.minutes
    // Insufficient mode: not even the floor fits; the plan is made anyway with a warning (section 9).
    if (day.minutes > limit + 0.05 && mode !== 'insuficiente') fail(9, `${day.id}: ${day.minutes} min > ${limit}`)
    if (day.trimmed && mode !== 'insuficiente') {
      const floor = limit - (mode === 'completo' ? 15 : 5)
      if (day.minutes < floor) fail(9, `${day.id}: ${day.minutes} min < ${floor} tras recortes`)
    }
  })

  // 10. Strength days: no more than chosen, nor than the cap by experience (if on), nor 3 for under-18s.
  const n = plan.days.length
  if (n > ctx.requestedDays) fail(10, `${n} días > ${ctx.requestedDays} elegidos`)
  if (ctx.profile.age === 'menor' && n > 3) fail(10, `${n} días para menor de 18`)
  if (n !== ctx.days) fail(10, `${n} días ≠ ${ctx.days} calculados`)
  if (ctx.days < ctx.requestedDays && ctx.days < Math.max(2, STRENGTH_DAY_CAP[ctx.experience]) && ctx.profile.age !== 'menor') {
    fail(10, `${ctx.days} días: se recortaron sin llegar al tope`)
  }

  // 11. Two sessions with >= 3 direct sets of a muscle are >= 48 h apart (canonical weekdays). Core and calves
  //     recover in 24 h (table 5b).
  const layout = WEEK_LAYOUT[n]
  if (layout) {
    for (const m of MUSCLES) {
      const hours = m === 'core' || m === 'gemelo' ? RECOVERY_HOURS.light : RECOVERY_HOURS.standard
      const heavy = c.directPerDay.map((day, i) => (day[m] >= RECOVERY_HOURS.directSets ? layout[i] : -1)).filter((w) => w >= 0)
      for (let i = 0; i < heavy.length; i++) {
        const next = i + 1 < heavy.length ? heavy[i + 1] : heavy[0] + 7
        if (heavy.length > 1 && (next - heavy[i]) * 24 < hours) fail(11, `${m}: ${(next - heavy[i]) * 24} h entre sesiones`)
      }
    }
  }

  // 13. The 6 patterns of 7a at least once a week, unless no exercise fits this person.
  for (const p of REQUIRED_PATTERNS) {
    if (c.patternCount[p] > 0) continue
    if (!result.missingPatterns.includes(p) || !patternUnavailable(ctx, p)) fail(13, `falta el patrón ${p}`)
  }

  // 14. Proportions of table 6.
  const r = ratiosOf(c)
  if (r.pullPush < RATIOS.pullPush.min - 1e-9 || r.pullPush > RATIOS.pullPush.max + 1e-9) fail(14, `tirón:empuje ${fmt(r.pullPush)}`)
  if (c.patternSets.empujeV > 0 && (r.pushHV < RATIOS.horizontalVertical.min || r.pushHV > RATIOS.horizontalVertical.max)) {
    fail(14, `empuje horizontal:vertical ${fmt(r.pushHV)}`)
  }
  if (c.patternSets.tironV > 0 && (r.pullHV < RATIOS.horizontalVertical.min || r.pullHV > RATIOS.horizontalVertical.max)) {
    fail(14, `tirón horizontal:vertical ${fmt(r.pullHV)}`)
  }
  if (c.direct.femoral > 0 && (r.quadHam < RATIOS.quadHam.min || r.quadHam > RATIOS.quadHam.max)) fail(14, `cuádriceps:femorales ${fmt(r.quadHam)}`)
  if (r.rearFront < RATIOS.rearFront.min - 1e-9) fail(14, `deltoides posterior:anterior ${fmt(r.rearFront)}`)

  return out
}
