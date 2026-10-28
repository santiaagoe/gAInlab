import type { Equipment, Exercise, Injury, Muscle, Slot } from './types'

const ALL: Equipment[] = ['gimnasio', 'basico', 'casa']
const BAR: Equipment[] = ['gimnasio', 'basico']
const GYM: Equipment[] = ['gimnasio']

// Ordered by preference inside each slot: the first available option is the default.
export const EXERCISES: Exercise[] = [
  // Sentadilla
  { id: 'sentadilla-barra', name: 'Sentadilla con barra', slot: 'sentadilla', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda', 'rodilla'] },
  { id: 'prensa', name: 'Prensa de piernas', slot: 'sentadilla', kind: 'maquina', equip: GYM, compound: true },
  { id: 'hack', name: 'Sentadilla hack', slot: 'sentadilla', kind: 'maquina', equip: GYM, compound: true, avoid: ['rodilla'] },
  { id: 'goblet', name: 'Sentadilla goblet', slot: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'goblet-cajon', name: 'Sentadilla goblet a cajón', slot: 'sentadilla', kind: 'mancuerna', equip: ALL, compound: true },

  // Bisagra de cadera
  { id: 'rumano-barra', name: 'Peso muerto rumano con barra', slot: 'bisagra', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'hip-thrust-barra', name: 'Hip thrust con barra', slot: 'bisagra', kind: 'barra', equip: BAR, compound: true, muscles: ['gluteo', 'femoral'] },
  { id: 'rumano-mancuernas', name: 'Peso muerto rumano con mancuernas', slot: 'bisagra', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['espalda'] },
  { id: 'hip-thrust-mancuerna', name: 'Hip thrust con mancuerna', slot: 'bisagra', kind: 'mancuerna', equip: ALL, compound: true, muscles: ['gluteo', 'femoral'] },

  // Press horizontal
  { id: 'banca-barra', name: 'Press banca con barra', slot: 'pressHorizontal', kind: 'barra', equip: BAR, compound: true, avoid: ['hombro'] },
  { id: 'banca-mancuernas', name: 'Press banca con mancuernas', slot: 'pressHorizontal', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'press-pecho-maquina', name: 'Press de pecho en máquina', slot: 'pressHorizontal', kind: 'maquina', equip: GYM, compound: true },
  { id: 'inclinado-mancuernas', name: 'Press inclinado con mancuernas', slot: 'pressHorizontal', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'flexiones', name: 'Flexiones', slot: 'pressHorizontal', kind: 'corporal', equip: ALL, compound: true },

  // Press vertical
  { id: 'militar-barra', name: 'Press militar con barra', slot: 'pressVertical', kind: 'barra', equip: BAR, compound: true, avoid: ['hombro', 'espalda'] },
  { id: 'press-hombro-mancuernas', name: 'Press de hombro con mancuernas', slot: 'pressVertical', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['hombro'] },
  { id: 'press-hombro-maquina', name: 'Press de hombro en máquina', slot: 'pressVertical', kind: 'maquina', equip: GYM, compound: true, avoid: ['hombro'] },
  { id: 'landmine', name: 'Press landmine', slot: 'pressVertical', kind: 'barra', equip: BAR, compound: true },
  { id: 'lateral-sustituto', name: 'Elevaciones laterales con mancuernas', slot: 'pressVertical', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['hombro'] },

  // Remo
  { id: 'remo-barra', name: 'Remo con barra', slot: 'remo', kind: 'barra', equip: BAR, compound: true, avoid: ['espalda'] },
  { id: 'remo-polea', name: 'Remo en polea baja', slot: 'remo', kind: 'maquina', equip: GYM, compound: true },
  { id: 'remo-mancuerna', name: 'Remo con mancuerna a una mano', slot: 'remo', kind: 'mancuerna', equip: ALL, compound: true },
  { id: 'remo-pecho-apoyado', name: 'Remo con pecho apoyado', slot: 'remo', kind: 'mancuerna', equip: ALL, compound: true },

  // Tirón vertical
  { id: 'jalon', name: 'Jalón al pecho', slot: 'jalon', kind: 'maquina', equip: GYM, compound: true },
  { id: 'dominadas', name: 'Dominadas', slot: 'jalon', kind: 'corporal', equip: BAR, compound: true },
  { id: 'jalon-agarre-neutro', name: 'Jalón con agarre neutro', slot: 'jalon', kind: 'maquina', equip: GYM, compound: true },
  { id: 'remo-inclinado-mancuernas', name: 'Remo inclinado con mancuernas', slot: 'jalon', kind: 'mancuerna', equip: ALL, compound: true },

  // Unilateral
  { id: 'bulgara', name: 'Sentadilla búlgara', slot: 'unilateral', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['rodilla'] },
  { id: 'zancadas', name: 'Zancadas caminando', slot: 'unilateral', kind: 'mancuerna', equip: ALL, compound: true, avoid: ['rodilla'] },
  { id: 'step-up', name: 'Subida al cajón', slot: 'unilateral', kind: 'mancuerna', equip: ALL, compound: true },

  // Aislamiento pierna
  { id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', slot: 'cuadriceps', kind: 'maquina', equip: GYM, compound: false },
  { id: 'goblet-pausa', name: 'Sentadilla goblet con pausa', slot: 'cuadriceps', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['rodilla'] },
  { id: 'step-up-bajo', name: 'Subida al cajón bajo', slot: 'cuadriceps', kind: 'mancuerna', equip: ALL, compound: false },
  { id: 'curl-femoral', name: 'Curl femoral', slot: 'femoral', kind: 'maquina', equip: GYM, compound: false },
  { id: 'rumano-una-pierna', name: 'Peso muerto a una pierna', slot: 'femoral', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['espalda'] },
  { id: 'puente-una-pierna', name: 'Puente de glúteo a una pierna', slot: 'femoral', kind: 'mancuerna', equip: ALL, compound: false, muscles: ['gluteo', 'femoral'] },
  { id: 'gemelo-maquina', name: 'Elevación de talones en máquina', slot: 'gemelo', kind: 'maquina', equip: GYM, compound: false },
  { id: 'gemelo-mancuerna', name: 'Elevación de talones con mancuerna', slot: 'gemelo', kind: 'mancuerna', equip: ALL, compound: false },

  // Aislamiento torso
  { id: 'aperturas-maquina', name: 'Aperturas en máquina', slot: 'pecho', kind: 'maquina', equip: GYM, compound: false },
  { id: 'aperturas-mancuernas', name: 'Aperturas con mancuernas', slot: 'pecho', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['hombro'] },
  { id: 'cruce-poleas', name: 'Cruce de poleas', slot: 'pecho', kind: 'maquina', equip: GYM, compound: false },
  { id: 'elevaciones-laterales', name: 'Elevaciones laterales', slot: 'lateral', kind: 'mancuerna', equip: ALL, compound: false },
  { id: 'laterales-polea', name: 'Elevaciones laterales en polea', slot: 'lateral', kind: 'maquina', equip: GYM, compound: false },
  { id: 'curl-mancuernas', name: 'Curl de bíceps con mancuernas', slot: 'biceps', kind: 'mancuerna', equip: ALL, compound: false },
  { id: 'curl-barra', name: 'Curl de bíceps con barra', slot: 'biceps', kind: 'barra', equip: BAR, compound: false },
  { id: 'curl-martillo', name: 'Curl martillo', slot: 'biceps', kind: 'mancuerna', equip: ALL, compound: false },
  { id: 'triceps-polea', name: 'Extensión de tríceps en polea', slot: 'triceps', kind: 'maquina', equip: GYM, compound: false },
  { id: 'frances-mancuernas', name: 'Press francés con mancuernas', slot: 'triceps', kind: 'mancuerna', equip: ALL, compound: false },
  { id: 'triceps-sobre-cabeza', name: 'Extensión de tríceps sobre la cabeza', slot: 'triceps', kind: 'mancuerna', equip: ALL, compound: false, avoid: ['hombro'] },
]

const SLOT_MUSCLES: Record<Slot, Muscle[]> = {
  sentadilla: ['cuadriceps', 'gluteo'],
  bisagra: ['femoral', 'gluteo'],
  pressHorizontal: ['pecho', 'triceps', 'hombro'],
  pressVertical: ['hombro', 'triceps'],
  remo: ['espalda', 'biceps'],
  jalon: ['espalda', 'biceps'],
  unilateral: ['cuadriceps', 'gluteo'],
  cuadriceps: ['cuadriceps'],
  femoral: ['femoral'],
  gemelo: ['gemelo'],
  pecho: ['pecho'],
  lateral: ['hombro'],
  biceps: ['biceps'],
  triceps: ['triceps'],
}

export const MUSCLE_NAMES: Record<Muscle, string> = {
  cuadriceps: 'cuádriceps',
  gluteo: 'glúteos',
  femoral: 'femorales',
  gemelo: 'gemelos',
  pecho: 'pecho',
  espalda: 'espalda',
  hombro: 'hombros',
  biceps: 'bíceps',
  triceps: 'tríceps',
}

/** Order used to group the exercise picker, from the main target muscle. */
export const MUSCLE_ORDER: Muscle[] = ['pecho', 'espalda', 'hombro', 'cuadriceps', 'gluteo', 'femoral', 'gemelo', 'biceps', 'triceps']

export function musclesOf(exercise: Exercise): Muscle[] {
  return exercise.muscles ?? SLOT_MUSCLES[exercise.slot]
}

export function mainMuscle(exercise: Exercise): Muscle {
  return musclesOf(exercise)[0]
}

/** "pecho, tríceps y hombros" */
export function listMuscles(muscles: Muscle[]): string {
  const names = muscles.map((m) => MUSCLE_NAMES[m])
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function isAvoided(exercise: Exercise, injuries: Injury[]): Injury[] {
  return (exercise.avoid ?? []).filter((i) => injuries.includes(i))
}

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  const ex = BY_ID.get(id)
  if (!ex) throw new Error(`Ejercicio desconocido: ${id}`)
  return ex
}

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id)
}

/** Exercises that fit a slot for this equipment, skipping those flagged for the user's injuries. */
export function optionsForSlot(slot: Slot, equipment: Equipment, injuries: Injury[]): Exercise[] {
  const fits = EXERCISES.filter((e) => e.slot === slot && e.equip.includes(equipment))
  const safe = fits.filter((e) => !e.avoid?.some((i) => injuries.includes(i)))
  return safe.length > 0 ? safe : fits
}
