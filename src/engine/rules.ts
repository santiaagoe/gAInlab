import type { AgeGroup, Experience, Feel, Goal, Muscle, Pattern } from './types'

/**
 * Training rules as typed data. Every number comes from docs/reglas-entrenamiento.md; the comment above each
 * constant names its table. Change the numbers here, never inside the generator.
 */

export interface Range {
  min: number
  def: number
  max: number
}

/* ---------- 1a. Series semanales por músculo (fraccionales) ---------- */

export const WEEKLY_SETS: Record<Goal, Record<Experience, Range>> = {
  salud: {
    nuevo: { min: 4, def: 6, max: 10 },
    menos1: { min: 4, def: 8, max: 12 },
    mas1: { min: 6, def: 10, max: 14 },
  },
  hipertrofia: {
    nuevo: { min: 6, def: 8, max: 12 },
    menos1: { min: 8, def: 10, max: 16 },
    mas1: { min: 10, def: 12, max: 20 },
  },
  grasa: {
    nuevo: { min: 6, def: 8, max: 10 },
    menos1: { min: 8, def: 10, max: 14 },
    mas1: { min: 8, def: 12, max: 16 },
  },
  fuerza: {
    nuevo: { min: 4, def: 6, max: 10 },
    menos1: { min: 6, def: 8, max: 12 },
    mas1: { min: 6, def: 10, max: 14 },
  },
}

/* ---------- 6. Core: series directas por semana ---------- */

export const CORE_SETS: Range & { minSessions: number; minTypes: number } = { min: 2, def: 4, max: 10, minSessions: 2, minTypes: 2 }

/* ---------- 2. Frecuencia y series máximas por sesión ---------- */

export const FREQUENCY = {
  min: 2,
  /** Strength, > 1 year: main patterns three times a week. */
  strengthAdvanced: 3,
  max: { nuevo: 3, menos1: 3, mas1: 4 } as Record<Experience, number>,
}

/** Max fractional sets per muscle and session. */
export const SESSION_CAP: Record<Goal, Record<Experience, number>> = {
  hipertrofia: { nuevo: 6, menos1: 8, mas1: 10 },
  grasa: { nuevo: 6, menos1: 8, mas1: 10 },
  salud: { nuevo: 4, menos1: 6, mas1: 8 },
  fuerza: { nuevo: 6, menos1: 8, mas1: 8 },
}

/** Strength goal: max direct sets for the main exercise of the session (also below rule 5's 5, so it wins). */
export const STRENGTH_MAIN_SETS: Record<Experience, number> = { nuevo: 3, menos1: 3, mas1: 4 }

/** Min direct sets to include a muscle in a session. */
export const MIN_DIRECT_SETS_IN_SESSION = 2

/* ---------- 3. Repeticiones y RIR ---------- */

export interface RepRule {
  min: number
  max: number
  rir: number
}

export const REPS: Record<Exclude<Goal, 'grasa'>, Record<Experience, { compound: RepRule; isolation: RepRule }>> = {
  salud: {
    nuevo: { compound: { min: 10, max: 15, rir: 3 }, isolation: { min: 12, max: 15, rir: 3 } },
    menos1: { compound: { min: 8, max: 12, rir: 3 }, isolation: { min: 10, max: 15, rir: 2 } },
    mas1: { compound: { min: 8, max: 12, rir: 2 }, isolation: { min: 10, max: 15, rir: 2 } },
  },
  hipertrofia: {
    nuevo: { compound: { min: 10, max: 12, rir: 3 }, isolation: { min: 12, max: 15, rir: 2 } },
    menos1: { compound: { min: 8, max: 12, rir: 2 }, isolation: { min: 10, max: 15, rir: 2 } },
    mas1: { compound: { min: 6, max: 12, rir: 2 }, isolation: { min: 10, max: 20, rir: 1 } },
  },
  fuerza: {
    nuevo: { compound: { min: 8, max: 10, rir: 3 }, isolation: { min: 10, max: 12, rir: 3 } },
    menos1: { compound: { min: 5, max: 8, rir: 2 }, isolation: { min: 8, max: 12, rir: 2 } },
    mas1: { compound: { min: 3, max: 6, rir: 2 }, isolation: { min: 8, max: 12, rir: 2 } },
  },
}

/** "Perder grasa: igual que hipertrofia del mismo nivel". */
export function repRule(goal: Goal, experience: Experience, compound: boolean): RepRule {
  const row = REPS[goal === 'grasa' ? 'hipertrofia' : goal][experience]
  return compound ? row.compound : row.isolation
}

/** Hard limits (table 3, last two rows). */
export const REP_LIMITS = {
  compound: { min: 3, max: 15, minRir: 1 },
  isolation: { min: 6, max: 20, minRir: 0 },
  /** RIR 0 only on machines or cables, > 1 year. Free barbell: never 0. */
  newMinRir: 2,
}

/* ---------- 4a. Descanso entre series (segundos) ---------- */

export interface RestRule {
  def: number
  min: number
  max: number
}

export const REST: Record<Goal, { compound: RestRule; isolation: RestRule }> = {
  fuerza: { compound: { def: 180, min: 120, max: 300 }, isolation: { def: 90, min: 60, max: 120 } },
  hipertrofia: { compound: { def: 120, min: 90, max: 180 }, isolation: { def: 90, min: 60, max: 120 } },
  grasa: { compound: { def: 120, min: 90, max: 180 }, isolation: { def: 90, min: 60, max: 120 } },
  salud: { compound: { def: 90, min: 60, max: 120 }, isolation: { def: 60, min: 60, max: 90 } },
}

/** Antagonist superset: rest between rounds. */
export const SUPERSET_REST: { compound: RestRule; isolation: RestRule } = {
  compound: { def: 90, min: 60, max: 120 },
  isolation: { def: 60, min: 45, max: 90 },
}

/**
 * Heavy compounds (v0.5.1, decision of the author, not in the first version of the document): where LONG_REST applies,
 * the first compounds of each day, the ones with the most load, rest longer than the default of 4a.
 *
 * Why: Schoenfeld 2016 (21 trained men, 8 weeks) got more strength and muscle thickness with 3 min than with 1 min
 * between sets; Singer 2024 (meta-analysis of 9 studies, untrained people) finds a small gain above 60 s and none
 * above 90 s, with intervals that cross zero. The result does not contradict either study and stays inside the
 * range of 4a (90–180 s), so validation rule 8 still holds. Strength already rests 180 s.
 */
export const HEAVY_REST: RestRule & { count: number } = { count: 2, def: 150, min: 120, max: 180 }

/**
 * Long rest (v0.5.1, decision of the author): in hypertrophy and fat loss, sessions of 60 minutes or more keep the
 * defaults of 4a (heavy 150 s, compounds 120 s, isolation 90 s). Step 3 of table 8a is skipped there and the
 * generator goes straight to removing sets (steps 4–6), always keeping the minimum of 1a. Shorter sessions follow
 * table 8a as written (rest first), so the feasibility table 9c does not change for 30 and 45 minutes.
 * Strength already keeps 120 s as its floor.
 */
export const LONG_REST: { goals: Goal[]; fromMinutes: number } = { goals: ['hipertrofia', 'grasa'], fromMinutes: 60 }

/* ---------- 4b. Duración de la sesión ---------- */

export const DURATION = {
  secondsPerRep: 3,
  setupPerSet: 10,
  unilateralFactor: 2,
  /** General warm-up, minutes. */
  warmup: 5,
  /** Transition between exercises, seconds. */
  transition: 60,
  /** Each approach set, seconds. */
  approachSet: 60,
}

/** Approach sets before the first compound of each pattern in a session. */
export function approachSets(goal: Goal, experience: Experience): number {
  if (experience === 'nuevo') return 1
  if (goal === 'fuerza' && experience === 'mas1') return 3
  return 2
}

/* ---------- 5a. División según días ---------- */

export type DayKind = 'completo' | 'torso' | 'pierna' | 'empuje' | 'tiron'

export const SPLITS: Record<number, { name: string; days: DayKind[] }> = {
  2: { name: 'Cuerpo completo, 2 días', days: ['completo', 'completo'] },
  // Decision: A/B/C instead of the document's alternating A/B/A.
  3: { name: 'Cuerpo completo, 3 días', days: ['completo', 'completo', 'completo'] },
  4: { name: 'Torso y pierna, 4 días', days: ['torso', 'pierna', 'torso', 'pierna'] },
  5: { name: 'Torso, pierna, empuje y tirón, 5 días', days: ['torso', 'pierna', 'empuje', 'tiron', 'pierna'] },
  6: { name: 'Empuje, tirón y pierna, 6 días', days: ['empuje', 'tiron', 'pierna', 'empuje', 'tiron', 'pierna'] },
}

/** Strength days cap by experience; extra days are rest or cardio. Configurable (Ajustes). */
export const STRENGTH_DAY_CAP: Record<Experience, number> = { nuevo: 3, menos1: 4, mas1: 5 }

/** What each kind of day trains. */
export const DAY_MUSCLES: Record<DayKind, Muscle[]> = {
  completo: ['cuadriceps', 'gluteo', 'femoral', 'gemelo', 'pecho', 'espalda', 'deltAnterior', 'deltLateral', 'deltPosterior', 'biceps', 'triceps', 'core'],
  torso: ['pecho', 'espalda', 'deltAnterior', 'deltLateral', 'deltPosterior', 'biceps', 'triceps'],
  pierna: ['cuadriceps', 'gluteo', 'femoral', 'gemelo', 'core'],
  empuje: ['pecho', 'deltAnterior', 'deltLateral', 'triceps'],
  tiron: ['espalda', 'deltPosterior', 'biceps', 'core'],
}

export const DAY_PATTERNS: Record<DayKind, Pattern[]> = {
  completo: ['sentadilla', 'bisagra', 'empujeH', 'empujeV', 'tironH', 'tironV'],
  torso: ['empujeH', 'empujeV', 'tironH', 'tironV'],
  pierna: ['sentadilla', 'bisagra'],
  empuje: ['empujeH', 'empujeV'],
  tiron: ['tironH', 'tironV'],
}

/* ---------- 5b. Recuperación mínima (horas) ---------- */

export const RECOVERY_HOURS = {
  /** Same muscle with >= 3 direct sets in the previous session. */
  directSets: 3,
  standard: 48,
  /** Previous session with RIR <= 1 or > 8 fractional sets. */
  hard: 72,
  light: 24,
}

/**
 * Canonical weekdays for each number of days (0 = Monday). The app rotates days without dates, so this is only
 * used to check recovery and as a hint. Agreed in phase 1.
 */
export const WEEK_LAYOUT: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

/* ---------- 6. Proporciones ---------- */

export const RATIOS = {
  pullPush: { min: 1.0, max: 1.5 },
  horizontalVertical: { min: 0.5, max: 2.0 },
  quadHam: { min: 0.75, max: 1.5 },
  rearFront: { min: 0.75 },
}

/** Muscles counted on each side of the pull:push ratio (fractional sets, agreed in phase 1). */
export const PULL_MUSCLES: Muscle[] = ['espalda', 'deltPosterior', 'biceps']
export const PUSH_MUSCLES: Muscle[] = ['pecho', 'deltAnterior', 'triceps']

/* ---------- 7a. Selección ---------- */

export const REQUIRED_PATTERNS: Pattern[] = ['sentadilla', 'bisagra', 'empujeH', 'empujeV', 'tironH', 'tironV']

export const SELECTION = {
  compoundShare: 0.6,
  exercisesPerSession: { nuevo: 6, menos1: 7, mas1: 8 } as Record<Experience, number>,
  exercisesPerMuscle: { nuevo: 1, menos1: 2, mas1: 2 } as Record<Experience, number>,
  setsPerExercise: { min: 2, max: 4 },
  /** Muscles that need at least one direct exercise a week (femorales: knee flexion). */
  isolationRequired: ['deltLateral', 'deltPosterior', 'gemelo', 'femoral'] as Muscle[],
}

/* ---------- 8a. Recortes ---------- */

export const TRIM = {
  /** Step 1: general warm-up 0–2 minutes (2 first, 0 only as a last resort) and approach sets. */
  warmup: 2,
  minWarmup: 0,
  approachSets: 1,
  /** Step 3: lowest rest allowed. */
  minRest: { compound: 90, strengthCompound: 120, isolation: 60 },
  /** Step 4: direct work removed first, down to the 1a minimum. */
  indirectlyCovered: ['deltAnterior', 'biceps', 'triceps'] as Muscle[],
}

/* ---------- 8b. Superseries ---------- */

export const SUPERSET_MAX: Record<Experience, number> = { nuevo: 2, menos1: 3, mas1: 3 }

/** Antagonist pairs allowed (by main muscle). Upper/lower pairs are also allowed. */
export const ANTAGONISTS: [Muscle, Muscle][] = [
  ['pecho', 'espalda'],
  ['biceps', 'triceps'],
  ['cuadriceps', 'femoral'],
]

/* ---------- 9a–9b. Modo reducido ---------- */

/** Floor in reduced mode (fractional sets/week). */
export const REDUCED_FLOOR: Record<Muscle, number> = {
  cuadriceps: 4,
  gluteo: 4,
  pecho: 4,
  espalda: 4,
  femoral: 4,
  deltAnterior: 2,
  biceps: 2,
  triceps: 2,
  deltLateral: 0,
  deltPosterior: 0,
  gemelo: 0,
  core: 0,
}

/** Reduced mode: RIR 1–2 (nuevo 2). */
export const REDUCED_RIR = 2

/** Order of cuts in reduced mode (1 = cut first). */
export type CutStep =
  | { kind: 'isolation'; muscle: Muscle }
  | { kind: 'pattern'; patterns: Pattern[] }

export const REDUCED_ORDER: CutStep[] = [
  { kind: 'isolation', muscle: 'deltAnterior' },
  { kind: 'isolation', muscle: 'biceps' },
  { kind: 'isolation', muscle: 'triceps' },
  { kind: 'isolation', muscle: 'gemelo' },
  { kind: 'isolation', muscle: 'deltLateral' },
  { kind: 'isolation', muscle: 'deltPosterior' },
  { kind: 'isolation', muscle: 'femoral' },
  { kind: 'isolation', muscle: 'core' },
  { kind: 'pattern', patterns: ['tironV', 'empujeV'] },
  { kind: 'pattern', patterns: ['bisagra'] },
]

/* ---------- 10a. Botones ---------- */

export const FEEL_RIR: Record<Feel, { assumed: number; min: number; max: number }> = {
  facil: { assumed: 5, min: 4, max: Infinity },
  justo: { assumed: 3, min: 2, max: 4 },
  limite: { assumed: 1, min: 0, max: 2 },
}

/** Reps in reserve assumed for a button press, with the +1 correction above 12 reps. */
export function rirFromFeel(feel: Feel, reps: number): number {
  return FEEL_RIR[feel].assumed + (reps > 12 ? 1 : 0)
}

/** Button the person should press when the set lands on the target RIR. */
export function expectedFeel(rir: number): Feel {
  return rir <= 1 ? 'limite' : rir >= 4 ? 'facil' : 'justo'
}

/* ---------- 11a–11b. Edad ---------- */

export interface AgeDoc {
  /** Use the "Nuevo" row of 1a whatever the experience. */
  volumeAsNew?: boolean
  /** Default = minimum of 1a (week 1). */
  startAtMin?: boolean
  /** Max = default of 1a. */
  maxIsDefault?: boolean
  maxDays?: number
  maxSetsPerExercise?: number
  minReps?: number
  minRepsNew?: number
  minRir?: number
  minRirNew?: number
  extraRest: number
  recoveryHours?: number
  /** Free barbell: false = never; 'mas1' = only with > 1 year; true = no change. */
  freeBarbell: boolean | 'mas1'
  /** Supersets: false = none; 'maquina' = antagonists on machines only. */
  supersets: boolean | 'maquina'
}

export const AGE_DOC: Record<AgeGroup, AgeDoc> = {
  // Barbell needs qualified supervision in person; the app cannot check it, so it never suggests it.
  menor: { volumeAsNew: true, maxDays: 3, maxSetsPerExercise: 3, minReps: 6, minRir: 2, extraRest: 0, recoveryHours: 48, freeBarbell: false, supersets: false },
  '18-29': { extraRest: 0, freeBarbell: true, supersets: true },
  '30-39': { extraRest: 0, freeBarbell: true, supersets: true },
  '40-49': { extraRest: 0, freeBarbell: true, supersets: true },
  '50-59': { startAtMin: true, extraRest: 0, freeBarbell: true, supersets: true },
  '60-69': { startAtMin: true, maxIsDefault: true, maxSetsPerExercise: 3, minReps: 6, minRepsNew: 10, minRir: 2, extraRest: 30, recoveryHours: 48, freeBarbell: 'mas1', supersets: 'maquina' },
  '70+': { startAtMin: true, maxIsDefault: true, maxSetsPerExercise: 3, minReps: 8, minRepsNew: 10, minRir: 2, minRirNew: 3, extraRest: 60, recoveryHours: 72, freeBarbell: false, supersets: false },
}
