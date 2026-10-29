import type { AgeGroup } from './types'

/**
 * How age changes the plan and the progression.
 *
 * People of every age gain strength and muscle with progressive overload, but recovery gets slower,
 * strength is lost faster after a break, and very heavy efforts carry more risk. Teenagers progress
 * well but should avoid max attempts and train under supervision. These are conservative rules of
 * thumb, not medical advice.
 */
export interface AgeRules {
  /** May raise two weight steps at once when the last session felt easy. */
  doubleJump: boolean
  /** At the top of the range but "al límite": hold the weight one more session before raising it. */
  consolidateAtLimit: boolean
  /** Lowest rep target in generated plans (avoids very heavy sets). */
  minReps: number
  /** Extra rest between sets for main and secondary lifts, in seconds. */
  extraRest: number
  /** Cap on sets for main lifts. */
  maxMainSets: number
  /** Days without an exercise before return mode kicks in. */
  returnAfterDays: number
  /** Additional weight reduction in return mode (0.05 = 5% more). */
  returnExtra: number
  /** Warm-up may include a single at ~85%. */
  heavySingles: boolean
  /** Extra light warm-up set for dumbbells and machines. */
  extraWarmup: boolean
  /** Prefer machines and dumbbells over the most technical barbell lifts for non-experienced lifters. */
  preferSafeVariants: boolean
}

const BASE: AgeRules = {
  doubleJump: true,
  consolidateAtLimit: false,
  minReps: 1,
  extraRest: 0,
  maxMainSets: 5,
  returnAfterDays: 14,
  returnExtra: 0,
  heavySingles: true,
  extraWarmup: false,
  preferSafeVariants: false,
}

const RULES: Record<AgeGroup, AgeRules> = {
  menor: { ...BASE, doubleJump: false, consolidateAtLimit: true, minReps: 6, maxMainSets: 3, heavySingles: false },
  '18-29': BASE,
  '30-39': BASE,
  '40-49': { ...BASE, extraRest: 15 },
  '50-59': {
    ...BASE,
    doubleJump: false,
    consolidateAtLimit: true,
    minReps: 6,
    extraRest: 30,
    maxMainSets: 4,
    returnAfterDays: 12,
    returnExtra: 0.05,
    heavySingles: false,
    extraWarmup: true,
  },
  '60-69': {
    ...BASE,
    doubleJump: false,
    consolidateAtLimit: true,
    minReps: 8,
    extraRest: 30,
    maxMainSets: 3,
    returnAfterDays: 10,
    returnExtra: 0.05,
    heavySingles: false,
    extraWarmup: true,
    preferSafeVariants: true,
  },
  '70+': {
    ...BASE,
    doubleJump: false,
    consolidateAtLimit: true,
    minReps: 8,
    extraRest: 45,
    maxMainSets: 3,
    returnAfterDays: 10,
    returnExtra: 0.1,
    heavySingles: false,
    extraWarmup: true,
    preferSafeVariants: true,
  },
}

/** Rules for an age group; without an age the app keeps its standard behaviour. */
export function ageRules(age?: AgeGroup): AgeRules {
  return age ? RULES[age] : BASE
}

export const AGE_LABELS: Record<AgeGroup, string> = {
  menor: 'Menos de 18',
  '18-29': '18 a 29',
  '30-39': '30 a 39',
  '40-49': '40 a 49',
  '50-59': '50 a 59',
  '60-69': '60 a 69',
  '70+': '70 o más',
}

export const AGE_GROUPS = Object.keys(AGE_LABELS) as AgeGroup[]

/** One or two sentences for the plan summary explaining what changes for this age. */
export function ageSummary(age?: AgeGroup): string | null {
  switch (age) {
    case 'menor':
      return 'Como tienes menos de 18 años, usamos series de 6 o más repeticiones, sin intentos máximos, y subimos de a un salto. Lo ideal es entrenar con un adulto o profesional que revise tu técnica.'
    case '40-49':
      return 'Sumamos algo más de descanso entre series en los ejercicios principales.'
    case '50-59':
      return 'Desde los 50 la recuperación es más lenta: más descanso entre series, subidas de a un salto y solo cuando la sesión anterior no fue al límite, y más prudencia al volver de una pausa.'
    case '60-69':
    case '70+':
      return 'A esta edad se sigue ganando fuerza y músculo, con una progresión más gradual: series de 8 o más repeticiones, más descanso, subidas de a un salto cuando la sesión no fue al límite y más prudencia al volver de una pausa. Si tienes alguna condición médica, consulta antes con un profesional.'
    default:
      return null
  }
}
