import type { CustomExercise, Equipment, Exercise, Injury, Muscle, Pattern, Slot } from './types'

const ALL: Equipment[] = ['gimnasio', 'basico', 'casa']
/** Barbells, dumbbells, bench and pull-up bar. */
const BAR: Equipment[] = ['gimnasio', 'basico']
/** Machines and cables. */
const GYM: Equipment[] = ['gimnasio']

// Ordered by preference inside each pattern: the generator takes the first one that fits the person.
// `avoid` marks exercises that usually load a sore area; the generator never picks them for that person.
export const EXERCISES: Exercise[] = [
  // Sentadilla y prensa (cuádriceps 1, glúteos 0,5)
  { id: 'sentadilla-barra', name: 'Sentadilla con barra', slot: 'sentadilla', pattern: 'sentadilla', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda', 'rodilla'] },
  { id: 'prensa', name: 'Prensa de piernas', slot: 'sentadilla', pattern: 'sentadilla', kind: 'maquina', equip: GYM, compound: true },
  { id: 'hack', name: 'Sentadilla hack', slot: 'sentadilla', pattern: 'sentadilla', kind: 'maquina', equip: GYM, compound: true, avoid: ['rodilla'] },
  { id: 'goblet', name: 'Sentadilla goblet', slot: 'sentadilla', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'goblet-cajon', name: 'Sentadilla goblet a cajón', slot: 'sentadilla', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'goblet-pausa', name: 'Sentadilla goblet con pausa', slot: 'sentadilla', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['rodilla'] },
  { id: 'bulgara', name: 'Sentadilla búlgara', slot: 'unilateral', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true, avoid: ['rodilla'] },
  { id: 'zancadas', name: 'Zancadas caminando', slot: 'unilateral', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true, avoid: ['rodilla'] },
  { id: 'step-up', name: 'Subida al cajón', slot: 'unilateral', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true },
  { id: 'step-up-bajo', name: 'Subida al cajón bajo', slot: 'unilateral', pattern: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true },

  // Bisagra de cadera (femorales 1, glúteos 0,5)
  { id: 'rumano-barra', name: 'Peso muerto rumano con barra', slot: 'bisagra', pattern: 'bisagra', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'rumano-mancuernas', name: 'Peso muerto rumano con mancuernas', slot: 'bisagra', pattern: 'bisagra', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['espalda'] },
  { id: 'pull-through', name: 'Pull-through en polea', slot: 'bisagra', pattern: 'bisagra', kind: 'maquina', equip: GYM, compound: true },
  { id: 'peso-muerto', name: 'Peso muerto convencional', slot: 'bisagra', pattern: 'bisagra', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'rumano-una-pierna', name: 'Peso muerto a una pierna', slot: 'bisagra', pattern: 'bisagra', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true, avoid: ['espalda'] },

  // Hip thrust y puente (glúteos 1; no cuenta como bisagra)
  { id: 'hip-thrust-mancuerna', name: 'Hip thrust con mancuerna', slot: 'gluteo', pattern: 'hipThrust', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'hip-thrust-barra', name: 'Hip thrust con barra', slot: 'gluteo', pattern: 'hipThrust', kind: 'barra', equip: BAR, compound: true },
  { id: 'puente-una-pierna', name: 'Puente de glúteo a una pierna', slot: 'gluteo', pattern: 'hipThrust', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true },

  // Empuje horizontal (pecho 1, tríceps y deltoides anterior 0,5)
  { id: 'banca-barra', name: 'Press banca con barra', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'barra', equip: BAR, compound: true, avoid: ['hombro'] },
  { id: 'banca-mancuernas', name: 'Press banca con mancuernas', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'press-pecho-maquina', name: 'Press de pecho en máquina', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'maquina', equip: GYM, compound: true },
  { id: 'inclinado-mancuernas', name: 'Press inclinado con mancuernas', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'inclinado-barra', name: 'Press inclinado con barra', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'barra', equip: BAR, compound: true, avoid: ['hombro'] },
  { id: 'flexiones', name: 'Flexiones', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'corporal', equip: ALL, compound: true },
  { id: 'fondos', name: 'Fondos en paralelas', slot: 'pressHorizontal', pattern: 'empujeH', kind: 'corporal', equip: BAR, compound: true, avoid: ['hombro'] },

  // Empuje vertical (deltoides anterior 1, tríceps y deltoides lateral 0,5)
  { id: 'militar-barra', name: 'Press militar con barra', slot: 'pressVertical', pattern: 'empujeV', kind: 'barra', equip: BAR, compound: true, avoid: ['hombro', 'espalda'] },
  { id: 'press-hombro-mancuernas', name: 'Press de hombro con mancuernas', slot: 'pressVertical', pattern: 'empujeV', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['hombro'] },
  { id: 'press-hombro-maquina', name: 'Press de hombro en máquina', slot: 'pressVertical', pattern: 'empujeV', kind: 'maquina', equip: GYM, compound: true, avoid: ['hombro'] },
  { id: 'landmine', name: 'Press landmine', slot: 'pressVertical', pattern: 'empujeV', kind: 'barra', equip: BAR, compound: true },

  // Tirón horizontal (espalda 1, bíceps y deltoides posterior 0,5)
  { id: 'remo-barra', name: 'Remo con barra', slot: 'remo', pattern: 'tironH', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'remo-polea', name: 'Remo en polea baja', slot: 'remo', pattern: 'tironH', kind: 'maquina', equip: GYM, compound: true },
  { id: 'remo-pecho-apoyado', name: 'Remo con pecho apoyado', slot: 'remo', pattern: 'tironH', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'remo-t', name: 'Remo en barra T', slot: 'remo', pattern: 'tironH', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'remo-inclinado-mancuernas', name: 'Remo inclinado con mancuernas', slot: 'remo', pattern: 'tironH', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['espalda'] },
  { id: 'remo-mancuerna', name: 'Remo con mancuerna a una mano', slot: 'remo', pattern: 'tironH', kind: 'mancuerna', equip: ALL, compound: true, unilateral: true },

  // Tirón vertical (espalda 1, bíceps 0,5)
  { id: 'jalon', name: 'Jalón al pecho', slot: 'jalon', pattern: 'tironV', kind: 'maquina', equip: GYM, compound: true },
  { id: 'jalon-agarre-neutro', name: 'Jalón con agarre neutro', slot: 'jalon', pattern: 'tironV', kind: 'maquina', equip: GYM, compound: true },
  { id: 'dominadas', name: 'Dominadas', slot: 'jalon', pattern: 'tironV', kind: 'corporal', equip: BAR, compound: true },
  { id: 'pullover-mancuerna', name: 'Pullover con mancuerna', slot: 'jalon', pattern: 'tironV', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['hombro'] },

  // Aislamiento de pierna
  { id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', slot: 'cuadriceps', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['cuadriceps'] },
  { id: 'curl-femoral', name: 'Curl femoral', slot: 'femoral', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['femoral'] },
  { id: 'curl-femoral-mancuerna', name: 'Curl femoral tumbado con mancuerna', slot: 'femoral', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['femoral'] },
  { id: 'gemelo-maquina', name: 'Elevación de talones en máquina', slot: 'gemelo', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['gemelo'] },
  { id: 'gemelo-mancuerna', name: 'Elevación de talones con mancuerna', slot: 'gemelo', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['gemelo'] },

  // Aislamiento de torso
  { id: 'aperturas-maquina', name: 'Aperturas en máquina', slot: 'pecho', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['pecho'] },
  { id: 'cruce-poleas', name: 'Cruce de poleas', slot: 'pecho', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['pecho'] },
  { id: 'aperturas-mancuernas', name: 'Aperturas con mancuernas', slot: 'pecho', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['hombro'], muscles: ['pecho'] },
  { id: 'elevaciones-laterales', name: 'Elevaciones laterales', slot: 'lateral', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['deltLateral'] },
  { id: 'laterales-polea', name: 'Elevaciones laterales en polea', slot: 'lateral', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, unilateral: true, muscles: ['deltLateral'] },
  { id: 'lateral-sustituto', name: 'Elevaciones laterales con mancuernas', slot: 'lateral', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, legacy: true, muscles: ['deltLateral'] },
  { id: 'face-pull', name: 'Face pull en polea', slot: 'posterior', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['deltPosterior'] },
  { id: 'pajaros-maquina', name: 'Pájaros en máquina', slot: 'posterior', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['deltPosterior'] },
  { id: 'pajaros', name: 'Pájaros con mancuernas', slot: 'posterior', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['deltPosterior'] },
  { id: 'curl-mancuernas', name: 'Curl de bíceps con mancuernas', slot: 'biceps', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['biceps'] },
  { id: 'curl-predicador', name: 'Curl predicador', slot: 'biceps', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['biceps'] },
  { id: 'curl-martillo', name: 'Curl martillo', slot: 'biceps', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['biceps'] },
  { id: 'curl-barra', name: 'Curl de bíceps con barra', slot: 'biceps', pattern: 'aislamiento', kind: 'barra', equip: BAR, compound: false, muscles: ['biceps'] },
  { id: 'triceps-polea', name: 'Extensión de tríceps en polea', slot: 'triceps', pattern: 'aislamiento', kind: 'maquina', equip: GYM, compound: false, muscles: ['triceps'] },
  { id: 'frances-mancuernas', name: 'Press francés con mancuernas', slot: 'triceps', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['triceps'] },
  { id: 'triceps-sobre-cabeza', name: 'Extensión de tríceps sobre la cabeza', slot: 'triceps', pattern: 'aislamiento', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['hombro'], muscles: ['triceps'] },

  // Core (tabla 6: anti-extensión y anti-rotación o lateral)
  { id: 'dead-bug', name: 'Dead bug', slot: 'core', pattern: 'core', kind: 'corporal', equip: ALL, compound: false, coreType: 'antiExtension', muscles: ['core'] },
  { id: 'pallof', name: 'Pallof press en polea', slot: 'core', pattern: 'core', kind: 'maquina', equip: GYM, compound: false, unilateral: true, coreType: 'antiRotacion', muscles: ['core'] },
  { id: 'bird-dog', name: 'Bird dog', slot: 'core', pattern: 'core', kind: 'corporal', equip: ALL, compound: false, unilateral: true, coreType: 'antiRotacion', muscles: ['core'] },
  { id: 'crunch-polea', name: 'Crunch en polea', slot: 'core', pattern: 'core', kind: 'maquina', equip: GYM, compound: false, coreType: 'flexion', avoid: ['espalda'], muscles: ['core'] },
  { id: 'plancha', name: 'Plancha (segundos)', slot: 'core', pattern: 'core', kind: 'corporal', equip: ALL, compound: false, hold: true, coreType: 'antiExtension', muscles: ['core'] },
  { id: 'plancha-lateral', name: 'Plancha lateral (segundos)', slot: 'core', pattern: 'core', kind: 'corporal', equip: ALL, compound: false, hold: true, unilateral: true, coreType: 'lateral', muscles: ['core'] },
]

/** Fractional sets each pattern gives (table 1b): 1 for the main target, 0.5 for secondary muscles. */
export const PATTERN_MUSCLES: Record<Exclude<Pattern, 'aislamiento' | 'core'>, Partial<Record<Muscle, number>>> = {
  sentadilla: { cuadriceps: 1, gluteo: 0.5 },
  bisagra: { femoral: 1, gluteo: 0.5 },
  empujeH: { pecho: 1, triceps: 0.5, deltAnterior: 0.5 },
  empujeV: { deltAnterior: 1, triceps: 0.5, deltLateral: 0.5 },
  tironH: { espalda: 1, biceps: 0.5, deltPosterior: 0.5 },
  tironV: { espalda: 1, biceps: 0.5 },
  hipThrust: { gluteo: 1 },
}

export const MUSCLES: Muscle[] = [
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

export const MUSCLE_NAMES: Record<Muscle, string> = {
  cuadriceps: 'cuádriceps',
  gluteo: 'glúteos',
  femoral: 'femorales',
  gemelo: 'gemelos',
  pecho: 'pecho',
  espalda: 'espalda',
  deltAnterior: 'hombro anterior',
  deltLateral: 'hombro lateral',
  deltPosterior: 'hombro posterior',
  biceps: 'bíceps',
  triceps: 'tríceps',
  core: 'core',
}

/** Order used to group the exercise picker, from the main target muscle. */
export const MUSCLE_ORDER: Muscle[] = [
  'pecho',
  'espalda',
  'deltAnterior',
  'deltLateral',
  'deltPosterior',
  'cuadriceps',
  'gluteo',
  'femoral',
  'gemelo',
  'biceps',
  'triceps',
  'core',
]

/** Fractional sets one set of this exercise gives each muscle. */
export function contributions(exercise: Exercise): Partial<Record<Muscle, number>> {
  if (exercise.pattern === 'aislamiento' || exercise.pattern === 'core') {
    const target = exercise.muscles?.[0] ?? (exercise.pattern === 'core' ? 'core' : undefined)
    return target ? { [target]: 1 } : {}
  }
  return PATTERN_MUSCLES[exercise.pattern]
}

/** Muscles worked, main target first. */
export function musclesOf(exercise: Exercise): Muscle[] {
  if (exercise.unknown) return []
  const c = contributions(exercise)
  return MUSCLES.filter((m) => c[m] !== undefined).sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0))
}

export function mainMuscle(exercise: Exercise): Muscle {
  return musclesOf(exercise)[0]
}

/** "pecho, tríceps y hombro anterior" */
export function listMuscles(muscles: Muscle[]): string {
  const names = muscles.map((m) => MUSCLE_NAMES[m])
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function isAvoided(exercise: Exercise, injuries: Injury[]): Injury[] {
  return (exercise.avoid ?? []).filter((i) => injuries.includes(i))
}

/** Barbell exercises count as free barbell work (tables 3, 7b and 11b). */
export function isFreeBarbell(exercise: Exercise): boolean {
  return exercise.kind === 'barra'
}

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
const LIBRARY_IDS = new Set(EXERCISES.map((e) => e.id))
let CUSTOM: Exercise[] = []

/** Slot used for a user-made exercise, from the muscle it mainly trains. */
const SLOT_FOR_MUSCLE: Record<Muscle, Slot> = {
  pecho: 'pecho',
  espalda: 'remo',
  deltAnterior: 'pressVertical',
  deltLateral: 'lateral',
  deltPosterior: 'posterior',
  cuadriceps: 'cuadriceps',
  gluteo: 'gluteo',
  femoral: 'femoral',
  gemelo: 'gemelo',
  biceps: 'biceps',
  triceps: 'triceps',
  core: 'core',
}

/** Pattern of a user-made compound, from its main muscle (table 1b). */
const COMPOUND_PATTERN: Partial<Record<Muscle, Pattern>> = {
  pecho: 'empujeH',
  espalda: 'tironH',
  deltAnterior: 'empujeV',
  cuadriceps: 'sentadilla',
  femoral: 'bisagra',
  gluteo: 'hipThrust',
}

/** "hombro" was a single muscle until v0.4; it now means the lateral deltoid. */
export function normalizeMuscle(muscle: string): Muscle | null {
  if (muscle === 'hombro') return 'deltLateral'
  return (MUSCLES as string[]).includes(muscle) ? (muscle as Muscle) : null
}

export function fromCustom(c: CustomExercise): Exercise {
  const muscle = normalizeMuscle(c.muscle) ?? 'pecho'
  const pattern: Pattern = muscle === 'core' ? 'core' : c.compound ? (COMPOUND_PATTERN[muscle] ?? 'aislamiento') : 'aislamiento'
  return {
    id: c.id,
    name: c.name,
    slot: SLOT_FOR_MUSCLE[muscle],
    pattern,
    kind: c.kind,
    equip: ['gimnasio', 'basico', 'casa'],
    compound: c.compound,
    muscles: [muscle],
    custom: true,
  }
}

function isCustomExercise(c: unknown): c is CustomExercise {
  if (!c || typeof c !== 'object') return false
  const x = c as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.compound === 'boolean' &&
    typeof x.kind === 'string' &&
    ['barra', 'mancuerna', 'maquina', 'corporal'].includes(x.kind) &&
    typeof x.muscle === 'string' &&
    normalizeMuscle(x.muscle) !== null &&
    !LIBRARY_IDS.has(x.id)
  )
}

/**
 * Makes the user's own exercises available everywhere the library is used.
 * The new list is built first and swapped in at the end, so a bad entry never leaves the registry half-updated.
 */
export function registerCustomExercises(list: readonly unknown[]) {
  const next = (Array.isArray(list) ? list : []).filter(isCustomExercise).map(fromCustom)
  CUSTOM.forEach((e) => BY_ID.delete(e.id))
  CUSTOM = next
  CUSTOM.forEach((e) => BY_ID.set(e.id, e))
}

/** Library plus the user's own exercises. */
export function allExercises(): Exercise[] {
  return [...CUSTOM, ...EXERCISES]
}

/** True for exercises in the built-in library (not the user's own). */
export function isLibraryExercise(id: string): boolean {
  return LIBRARY_IDS.has(id)
}

/**
 * Exercise by id. An id that is not in the library (an old backup, a renamed exercise) returns a placeholder
 * instead of throwing, so the app keeps working and the user can replace it from the plan.
 */
export function getExercise(id: string): Exercise {
  return BY_ID.get(id) ?? unknownExercise(id)
}

export function unknownExercise(id: string): Exercise {
  return {
    id,
    name: 'Ejercicio no encontrado',
    slot: 'pecho',
    pattern: 'aislamiento',
    kind: 'maquina',
    equip: ['gimnasio', 'basico', 'casa'],
    compound: false,
    muscles: [],
    unknown: true,
  }
}

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id)
}
