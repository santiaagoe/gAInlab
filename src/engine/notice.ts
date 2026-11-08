import { minimumFor, reviewPlan, type CoverageReview, type PlanMode } from './coverage'
import { MUSCLE_NAMES, MUSCLES } from './exercises'
import { generatePlan, PATTERN_NAMES, type Suggestion } from './generator'
import { contextFor, type Options } from './targets'
import type { Muscle, Plan, Profile } from './types'

/**
 * Texts shown in the app about how well a plan covers the week. Kept here, next to the rules, so they can be
 * tested; the screens only lay them out. Neutral Spanish, short, no promises of results.
 */

function list(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function muscleList(muscles: Muscle[]): string {
  return list(muscles.map((m) => MUSCLE_NAMES[m]))
}

export interface NoticeAction {
  /** What changes in the survey. */
  patch: Pick<Profile, 'days'> | Pick<Profile, 'minutes'>
  label: string
}

export interface PlanNotice {
  mode: Exclude<PlanMode, 'completo'>
  title: string
  body: string
  /** +1 day and +15 minutes, only those that reach a complete plan. */
  actions: NoticeAction[]
  /** Shown when no action is offered. */
  hint?: string
}

function actionsFor(profile: Profile, suggestion: Suggestion | null, days: number): NoticeAction[] {
  if (!suggestion) return []
  const out: NoticeAction[] = []
  if (suggestion.addDay) out.push({ patch: { days: days + 1 }, label: `Entrenar ${days + 1} días` })
  if (suggestion.addMinutes) out.push({ patch: { minutes: profile.minutes + 15 }, label: `Sesiones de ${profile.minutes + 15} min` })
  return out
}

/**
 * Warning for a plan made by the rules engine that does not reach the recommended volume (reduced or
 * insufficient mode). Checks the plan as it is now, so edits count. Plans made before v0.5 (no `engine` mark)
 * never get one: the person can ask for a coverage review instead.
 */
export function planNotice(profile: Profile, plan: Plan, options: Options = {}): PlanNotice | null {
  if (!plan.engine || plan.custom) return null
  const ctx = contextFor(profile, options)
  const review = reviewPlan(ctx, plan)
  // Insufficient also means "does not fit in the minutes"; that is known for the plan as generated.
  const mode = review.mode === 'insuficiente' || (plan.engine.mode === 'insuficiente' && !plan.edited) ? 'insuficiente' : review.mode
  if (mode === 'completo') return null
  const generated = generatePlan(profile, options)
  const actions = generated.mode === 'completo' ? [] : actionsFor(profile, generated.suggestion, ctx.days)
  const hint = actions.length === 0 ? 'Para un plan completo hacen falta más días o sesiones más largas.' : undefined
  if (mode === 'insuficiente') {
    const longest = Math.ceil(Math.max(...generated.days.map((d) => d.minutes)))
    return {
      mode: 'insuficiente',
      title: 'Sesiones algo más largas',
      body: `Ni la versión mínima cabe en ${profile.minutes} minutos: cada sesión dura hasta ${longest}.`,
      actions,
      hint,
    }
  }
  const few = review.belowMin.length <= 4
  const who = few ? muscleList(review.belowMin) : `${review.belowMin.length} de ${MUSCLES.length} grupos musculares`
  const verb = review.belowMin.length === 1 ? 'queda' : 'quedan'
  return {
    mode: 'reducido',
    title: 'Versión reducida',
    body: `Con ${ctx.days} días de ${profile.minutes} minutos, ${who} ${verb} bajo el volumen recomendado. Piernas, pecho y espalda mantienen un mínimo de trabajo.`,
    actions,
    hint,
  }
}

export interface CoverageLine {
  muscle: Muscle
  name: string
  sets: number
  minimum: number
}

export interface CoverageReport {
  ok: boolean
  title: string
  /** Muscles under the minimum of table 1a, with their weekly sets. */
  below: CoverageLine[]
  /** Other findings, one sentence each. */
  notes: string[]
}

function rounded(n: number): number {
  return Math.round(n * 10) / 10
}

/** "Revisar cobertura": what the current plan covers, for any plan (generated, edited, old or the person's own). */
export function coverageReport(profile: Profile, plan: Plan, options: Options = {}): CoverageReport {
  const ctx = contextFor(profile, options)
  const review: CoverageReview = reviewPlan(ctx, plan)
  const below = review.belowMin.map((m) => ({ muscle: m, name: MUSCLE_NAMES[m], sets: rounded(review.weekly[m]), minimum: minimumFor(ctx, m) }))
  const notes: string[] = []
  if (review.missingPatterns.length > 0) notes.push(`Sin ejercicio de ${list(review.missingPatterns.map((p) => PATTERN_NAMES[p]))}.`)
  if (review.lowFrequency.length > 0) {
    const trained = review.lowFrequency.filter((m) => review.weekly[m] > 0)
    if (trained.length > 0) notes.push(`Solo una vez por semana: ${muscleList(trained)}. Lo recomendado son dos.`)
  }
  if (review.aboveMax.length > 0) notes.push(`Más series de lo recomendado: ${muscleList(review.aboveMax)}.`)
  const ok = below.length === 0 && notes.length === 0
  const covered = MUSCLES.length - below.length
  return {
    ok,
    title: ok ? `Tu plan cubre los ${MUSCLES.length} grupos musculares.` : `Tu plan cubre ${covered} de ${MUSCLES.length} grupos musculares.`,
    below,
    notes,
  }
}
