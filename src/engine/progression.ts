import { findExercise } from './exercises'
import type { ExerciseLog, Feel, Kind, PlanExercise, Prescription, Session, Settings } from './types'

export interface HistoryEntry {
  date: string
  log: ExerciseLog
}

const DAY_MS = 86_400_000

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

function formatKg(kg: number): string {
  return `${kg.toLocaleString('es-CL', { maximumFractionDigits: 2 })} kg`
}

function belowRange(summary: WorkSummary, plan: PlanExercise): boolean {
  const below = Array.from({ length: plan.sets }, (_, i) => summary.reps[i] ?? 0).filter(
    (r) => r < plan.repMin,
  ).length
  return below * 2 > plan.sets
}

export function prescribe(
  plan: PlanExercise,
  history: HistoryEntry[],
  settings: Settings,
  now: Date = new Date(),
): Prescription {
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
  const w = summary.weight
  const feel = last.log.feel
  const base = { last }
  const gapDays = Math.floor((now.getTime() - new Date(last.date).getTime()) / DAY_MS)

  // Modo regreso: long gap since this exercise was last trained.
  if (gapDays >= 14 && w > 0) {
    const factor = gapDays >= 56 ? 0.7 : gapDays >= 28 ? 0.8 : 0.9
    const weight = Math.max(step, roundDown(w * factor, step))
    const weeks = Math.floor(gapDays / 7)
    return {
      ...base,
      mode: 'regreso',
      weight,
      reps: fill(sets, repMin),
      delta: weight - w,
      note: `Llevas ${weeks} semanas sin este ejercicio: bajamos un ${Math.round((1 - factor) * 100)}% para retomar sin riesgo. Recuperarás el peso en pocas sesiones.`,
    }
  }

  // Bodyweight with no extra load: progress by reps.
  if (w === 0) {
    const allTop = summary.reps.length >= sets && summary.reps.every((r) => r >= repMax)
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

  // Calibration correction: reps landed far outside the range, so re-aim with the strength estimate.
  const top = Math.max(...summary.reps)
  const avg = summary.reps.reduce((a, b) => a + b, 0) / summary.reps.length
  if (avg > repMax + 2 || avg < repMin - 2) {
    const reserve = feel ? RESERVE[feel] : 1
    const e1 = epley(w, summary.reps[0] + reserve)
    const targetReps = repMin + 1
    let weight = roundTo(weightForReps(e1, targetReps + 1), step)
    if (avg > repMax + 2) weight = Math.max(weight, w + step)
    if (avg < repMin - 2) weight = Math.min(weight, roundDown(w - step, step))
    weight = Math.max(step, weight)
    return {
      ...base,
      mode: 'ajuste',
      weight,
      reps: fill(sets, targetReps),
      delta: weight - w,
      note:
        avg > repMax + 2
          ? `Hiciste ${top} repeticiones: el peso era liviano. Con ${formatKg(weight)} deberías quedar dentro del rango.`
          : `Quedaste lejos del rango. Con ${formatKg(weight)} deberías llegar a unas ${targetReps} repeticiones.`,
    }
  }

  const allTop = summary.reps.length >= sets && summary.reps.slice(0, sets).every((r) => r >= repMax)
  if (allTop) {
    const jump = feel === 'facil' && compound ? step * 2 : step
    const weight = roundTo(w + jump, step)
    return {
      ...base,
      mode: 'subir',
      weight,
      reps: fill(sets, repMin),
      delta: weight - w,
      note:
        jump > step
          ? `Completaste ${repMax} en todas las series y te sobró margen: subimos ${formatKg(jump)}.`
          : `Completaste ${repMax} en todas las series: subimos ${formatKg(jump)} y vuelves a ${repMin} repeticiones.`,
    }
  }

  if (belowRange(summary, plan)) {
    const prev = history.length >= 2 ? history[history.length - 2] : undefined
    const prevSummary = prev ? workSummary(prev.log) : undefined
    const failedTwice = prevSummary && prevSummary.weight === w && belowRange(prevSummary, plan)
    if (failedTwice) {
      const weight = Math.max(step, roundDown(w * 0.9, step))
      return {
        ...base,
        mode: 'bajar',
        weight,
        reps: fill(sets, repMin),
        delta: weight - w,
        note: 'Dos sesiones bajo el rango: bajamos un 10% para volver a progresar con buena técnica.',
      }
    }
    return {
      ...base,
      mode: 'repetir',
      weight: w,
      reps: fill(sets, repMin),
      delta: 0,
      note: `Quedaste bajo el rango: repite ${formatKg(w)} y apunta a ${repMin} repeticiones en cada serie.`,
    }
  }

  const reps = Array.from({ length: sets }, (_, i) => {
    const prior = summary.reps[i] ?? summary.reps[summary.reps.length - 1] ?? repMin
    return clamp(prior + (feel === 'limite' ? 0 : 1), repMin, repMax)
  })
  return {
    ...base,
    mode: 'mantener',
    weight: w,
    reps,
    delta: 0,
    note:
      feel === 'limite'
        ? 'Lo hiciste al límite: mismo peso y consolida las mismas repeticiones.'
        : 'Mismo peso: suma una repetición por serie.',
  }
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
export function warmupSets(work: number, kind: Kind, step: number): WarmupSet[] {
  if (work <= 0 || kind === 'corporal') return []
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
    if (work >= 80) push(roundDown(work * 0.85, step), 1)
    return out
  }
  if (work < 10) return []
  push(roundDown(work * 0.5, step), 8)
  push(roundDown(work * 0.75, step), 4)
  return out
}
