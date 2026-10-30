import { ageRules } from './age'
import { findExercise } from './exercises'
import { calendarDaysBetween, formatKg } from './units'
import type { AgeGroup, ExerciseLog, Feel, Kind, PlanExercise, Prescription, Session, Settings } from './types'

export interface HistoryEntry {
  date: string
  log: ExerciseLog
}

/** Reps "left in the tank" implied by each feel button, used to refine the strength estimate. */
const RESERVE: Record<Feel, number> = { facil: 3, justo: 1.5, limite: 0 }

export function epley(weight: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function weightForReps(e1rm: number, reps: number): number {
  return e1rm / (1 + reps / 30)
}

export function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100
}

export function roundDown(value: number, step: number): number {
  return Math.round(Math.floor(value / step + 1e-9) * step * 100) / 100
}

export function incrementFor(kind: Kind, settings: Settings): number {
  switch (kind) {
    case 'barra':
      return settings.incBarra
    case 'mancuerna':
      return settings.incMancuerna
    case 'maquina':
      return settings.incMaquina
    case 'corporal':
      return 2.5
  }
}

/** Best estimated 1RM in a logged exercise, counting only completed sets. */
export function bestE1rm(log: ExerciseLog): number {
  return log.sets
    .filter((s) => s.done && s.reps > 0)
    .reduce((best, s) => Math.max(best, epley(s.weight, s.reps)), 0)
}

export function historyFor(exerciseId: string, sessions: Session[]): HistoryEntry[] {
  return sessions
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done && x.reps > 0))
        .map((log) => ({ date: s.date, log })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

interface WorkSummary {
  weight: number
  reps: number[]
}

/** The heaviest weight used and the reps achieved at that weight, in order. */
function workSummary(log: ExerciseLog): WorkSummary {
  const done = log.sets.filter((s) => s.done && s.reps > 0)
  const weight = done.reduce((m, s) => Math.max(m, s.weight), 0)
  return { weight, reps: done.filter((s) => s.weight === weight).map((s) => s.reps) }
}

function fill(n: number, value: number): number[] {
  return Array.from({ length: n }, () => value)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

interface Dose {
  min: number
  max: number
  /** Sets completed in that session. */
  sets: number
}

/**
 * Rep range a logged session was done with. The same exercise can appear on two days with different doses
 * (for example 4×4–6 and 3×6–8), so each session is judged against its own range, not today's.
 */
function doseOf(log: ExerciseLog, plan: PlanExercise): Dose {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1
  const min = ok(log.repMin) ? log.repMin : plan.repMin
  const max = ok(log.repMax) && log.repMax >= min ? log.repMax : Math.max(min, plan.repMax)
  return { min, max, sets: log.sets.filter((s) => s.done && s.reps > 0).length }
}

/** Sets that must be at the top of the range: today's sets, or fewer if that session had fewer. */
function setsToCheck(plan: PlanExercise, dose: Dose): number {
  return Math.max(1, Math.min(plan.sets, dose.sets))
}

function atTop(summary: WorkSummary, plan: PlanExercise, dose: Dose): boolean {
  const n = setsToCheck(plan, dose)
  return summary.reps.length >= n && summary.reps.slice(0, n).every((r) => r >= dose.max)
}

/** Most of the sets done at the working weight fell short of the range. Missing sets are not counted as failures. */
function belowRange(summary: WorkSummary, dose: Dose): boolean {
  if (summary.reps.length === 0) return false
  return summary.reps.filter((r) => r < dose.min).length * 2 > summary.reps.length
}

function pauseText(days: number): string {
  if (days < 14) return `Llevas ${days} días sin entrenar`
  return `Llevas ${Math.floor(days / 7)} semanas sin entrenar`
}

/**
 * Next session for one exercise.
 * @param lastTrainedAt date of the user's last session of any exercise; a break is measured from it, so
 *   training fewer days than planned does not trigger return mode on every rotation.
 */
export function prescribe(
  plan: PlanExercise,
  history: HistoryEntry[],
  settings: Settings,
  now: Date = new Date(),
  age?: AgeGroup,
  lastTrainedAt?: string,
): Prescription {
  const rules = ageRules(age)
  const exercise = findExercise(plan.exerciseId)
  const kind: Kind = exercise?.kind ?? 'maquina'
  const compound = exercise?.compound ?? false
  const step = incrementFor(kind, settings)
  const { sets, repMin, repMax } = plan

  if (history.length === 0) {
    return {
      mode: 'calibracion',
      weight: null,
      reps: fill(sets, repMax),
      delta: 0,
      note:
        kind === 'corporal'
          ? `Primera vez: haz todas las repeticiones que puedas con buena técnica, hasta ${repMax}.`
          : `Primera vez: elige un peso con el que hagas unas ${repMin}–${repMax} repeticiones cómodas. Con eso calculamos tu próxima sesión.`,
    }
  }

  const last = history[history.length - 1]
  const summary = workSummary(last.log)
  const dose = doseOf(last.log, plan)
  const w = summary.weight
  const feel = last.log.feel
  const base = { last }

  // A break is time without training at all, not time since this particular exercise.
  const lastDate = new Date(last.date)
  const anyDate = lastTrainedAt ? new Date(lastTrainedAt) : lastDate
  const since = Number.isNaN(anyDate.getTime()) || anyDate < lastDate ? lastDate : anyDate
  const gapDays = calendarDaysBetween(since, now)

  // Weight from before a break that the user is still climbing back to.
  const pending = last.log.recoverTo
  const recoverTo = typeof pending === 'number' && pending > w ? pending : undefined
  const keepRecovery = (p: Prescription): Prescription =>
    recoverTo !== undefined && p.weight !== null && p.weight > 0 && p.weight < recoverTo ? { ...p, recoverTo } : p

  // Modo regreso: long break without training.
  if (gapDays >= rules.returnAfterDays && w > 0) {
    const factor = (gapDays >= 56 ? 0.7 : gapDays >= 28 ? 0.8 : 0.9) - rules.returnExtra
    const weight = Math.min(w, Math.max(step, roundDown(w * factor, step)))
    const target = Math.max(w, recoverTo ?? 0)
    return {
      ...base,
      mode: 'regreso',
      weight,
      reps: fill(sets, repMin),
      delta: weight - w,
      note: `${pauseText(gapDays)}: bajamos un ${Math.round((1 - factor) * 100)}% para retomar sin riesgo. Si las próximas sesiones salen bien, subimos más rápido hasta volver a ${formatKg(target)}.`,
      ...(target > weight ? { recoverTo: target } : {}),
    }
  }

  // Bodyweight with no extra load: progress by reps.
  if (w === 0) {
    const allTop = atTop(summary, plan, dose)
    const reps = Array.from({ length: sets }, (_, i) =>
      clamp((summary.reps[i] ?? summary.reps[summary.reps.length - 1] ?? repMin) + (feel === 'limite' ? 0 : 1), 1, repMax),
    )
    return {
      ...base,
      mode: 'mantener',
      weight: 0,
      reps: allTop ? fill(sets, repMax) : reps,
      delta: 0,
      note: allTop
        ? `Llegaste al tope con tu peso corporal. Prueba añadir lastre (${formatKg(2.5)}) o una variante más difícil.`
        : 'Peso corporal: suma una repetición por serie.',
    }
  }

  // Calibration correction: only right after calibrating or a break, when the weight was still a guess.
  // In a normal session a bad day is handled by "repetir" and "bajar".
  const calibrating = history.length === 1 || recoverTo !== undefined
  const top = Math.max(...summary.reps)
  const avg = summary.reps.reduce((a, b) => a + b, 0) / summary.reps.length
  const tooLight = avg > dose.max + 2
  const tooHeavy = avg < dose.min - 2
  if (calibrating && (tooLight || tooHeavy)) {
    const reserve = feel ? RESERVE[feel] : 1
    const e1 = epley(w, summary.reps[0] + reserve)
    const targetReps = Math.min(repMin + 1, repMax)
    let weight = roundTo(weightForReps(e1, targetReps + 1), step)
    if (tooLight) weight = Math.max(weight, w + step)
    if (tooHeavy) weight = Math.min(w, Math.max(step, Math.min(weight, roundDown(w - step, step))))
    weight = Math.max(Math.min(step, w), weight)
    return keepRecovery({
      ...base,
      mode: 'ajuste',
      weight,
      reps: fill(sets, targetReps),
      delta: weight - w,
      note: tooLight
        ? `Hiciste ${top} repeticiones: el peso era liviano. Con ${formatKg(weight)} deberías quedar dentro del rango.`
        : `Quedaste lejos del rango. Con ${formatKg(weight)} deberías llegar a unas ${targetReps} repeticiones.`,
    })
  }

  const below = belowRange(summary, dose)
  const complete = summary.reps.length >= setsToCheck(plan, dose)

  // Coming back from a break: every completed session inside the range climbs faster, up to the old weight.
  if (recoverTo !== undefined && !below && complete && feel !== 'limite') {
    const weight = Math.min(recoverTo, Math.max(roundTo(w + step, step), roundDown(w + (recoverTo - w) / 2, step)))
    return keepRecovery({
      ...base,
      mode: 'subir',
      weight,
      reps: fill(sets, repMin),
      delta: weight - w,
      note:
        weight >= recoverTo
          ? `Vuelves a ${formatKg(weight)}, tu peso de antes de la pausa.`
          : `Vas recuperando tu peso de antes de la pausa: hoy ${formatKg(weight)}, la meta es ${formatKg(recoverTo)}.`,
    })
  }

  const allTop = atTop(summary, plan, dose)
  // Hold once at the top when it was a max effort; if the previous session already held this weight, go up.
  const prevEntry = history.length >= 2 ? history[history.length - 2] : undefined
  const prevSummary = prevEntry ? workSummary(prevEntry.log) : undefined
  const prevDose = prevEntry ? doseOf(prevEntry.log, plan) : undefined
  const prevAtTop = prevSummary && prevDose ? prevSummary.weight === w && atTop(prevSummary, plan, prevDose) : false
  if (allTop && feel === 'limite' && rules.consolidateAtLimit && !prevAtTop) {
    return keepRecovery({
      ...base,
      mode: 'mantener',
      weight: w,
      reps: fill(sets, repMax),
      delta: 0,
      note: `Llegaste a ${dose.max} repeticiones, pero al límite: repite ${formatKg(w)} una sesión más y, si sale con algo de margen, subimos.`,
    })
  }

  if (allTop) {
    const jump = feel === 'facil' && compound && rules.doubleJump ? step * 2 : step
    const weight = roundTo(w + jump, step)
    return keepRecovery({
      ...base,
      mode: 'subir',
      weight,
      reps: fill(sets, repMin),
      delta: weight - w,
      note:
        jump > step
          ? `Completaste ${dose.max} en todas las series y te sobró margen: subimos ${formatKg(jump)}.`
          : `Completaste ${dose.max} en todas las series: subimos ${formatKg(jump)} y vuelves a ${repMin} repeticiones.`,
    })
  }

  if (below) {
    const failedTwice = prevSummary && prevDose && prevSummary.weight === w && belowRange(prevSummary, prevDose)
    if (failedTwice) {
      const weight = Math.min(w, Math.max(step, roundDown(w * 0.9, step)))
      return {
        ...base,
        mode: 'bajar',
        weight,
        reps: fill(sets, repMin),
        delta: weight - w,
        note: 'Dos sesiones bajo el rango: bajamos un 10% para volver a progresar con buena técnica.',
      }
    }
    return keepRecovery({
      ...base,
      mode: 'repetir',
      weight: w,
      reps: fill(sets, repMin),
      delta: 0,
      note: `Quedaste bajo el rango: repite ${formatKg(w)} y apunta a ${repMin} repeticiones en cada serie.`,
    })
  }

  const reps = Array.from({ length: sets }, (_, i) => {
    const prior = summary.reps[i] ?? summary.reps[summary.reps.length - 1] ?? repMin
    return clamp(prior + (feel === 'limite' ? 0 : 1), repMin, repMax)
  })
  return keepRecovery({
    ...base,
    mode: 'mantener',
    weight: w,
    reps,
    delta: 0,
    note: !complete
      ? `Esta vez haz las ${sets} series con ${formatKg(w)}.`
      : feel === 'limite'
        ? 'Lo hiciste al límite: mismo peso y consolida las mismas repeticiones.'
        : 'Mismo peso: suma una repetición por serie.',
  })
}

export interface WarmupSet {
  weight: number
  reps: number
}

const BAR_KG = 20

/**
 * Ramp-up sets before the working weight of a compound lift.
 * Barbell: empty bar, then ~50%, ~70% and (for heavy work) ~85%. Dumbbells and machines: ~50% and ~75%.
 */
export function warmupSets(work: number, kind: Kind, step: number, age?: AgeGroup): WarmupSet[] {
  if (work <= 0 || kind === 'corporal') return []
  const rules = ageRules(age)
  const out: WarmupSet[] = []
  const push = (weight: number, reps: number) => {
    if (weight <= 0 || weight >= work) return
    if (out.some((s) => s.weight === weight)) return
    if (out.length > 0 && weight <= out[out.length - 1].weight) return
    out.push({ weight, reps })
  }
  if (kind === 'barra') {
    if (work < BAR_KG + 10) return []
    push(BAR_KG, 10)
    push(roundDown(work * 0.5, step), 5)
    push(roundDown(work * 0.7, step), 3)
    if (work >= 80) {
      if (rules.heavySingles) push(roundDown(work * 0.85, step), 1)
      else push(roundDown(work * 0.8, step), 2)
    }
    return out
  }
  if (work < 10) return []
  if (rules.extraWarmup && work >= 20) push(roundDown(work * 0.3, step), 12)
  push(roundDown(work * 0.5, step), 8)
  push(roundDown(work * 0.75, step), 4)
  return out
}
