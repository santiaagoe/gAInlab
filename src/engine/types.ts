export type AgeGroup = 'menor' | '18-29' | '30-39' | '40-49' | '50-59' | '60-69' | '70+'
export type Goal = 'hipertrofia' | 'grasa' | 'fuerza' | 'salud'
export type Experience = 'nuevo' | 'menos1' | 'mas1'
export type Situation = 'entreno' | 'regreso' | 'cero'
export type Equipment = 'gimnasio' | 'basico' | 'casa'
export type Injury = 'hombro' | 'rodilla' | 'espalda'
export type Feel = 'facil' | 'justo' | 'limite'
export type Kind = 'barra' | 'mancuerna' | 'maquina' | 'corporal'
export type Role = 'principal' | 'secundario' | 'accesorio'

export type Slot =
  | 'sentadilla'
  | 'bisagra'
  | 'pressHorizontal'
  | 'pressVertical'
  | 'remo'
  | 'jalon'
  | 'unilateral'
  | 'cuadriceps'
  | 'femoral'
  | 'gemelo'
  | 'pecho'
  | 'lateral'
  | 'biceps'
  | 'triceps'
  | 'posterior'
  | 'gluteo'
  | 'core'

/** Movement pattern (tables 1b and 7a of docs/reglas-entrenamiento.md). */
export type Pattern =
  | 'sentadilla'
  | 'bisagra'
  | 'empujeH'
  | 'empujeV'
  | 'tironH'
  | 'tironV'
  | 'hipThrust'
  | 'aislamiento'
  | 'core'

/** Type of core exercise (table 6). */
export type CoreType = 'antiExtension' | 'antiRotacion' | 'lateral' | 'flexion'

export type Muscle =
  | 'cuadriceps'
  | 'gluteo'
  | 'femoral'
  | 'gemelo'
  | 'pecho'
  | 'espalda'
  | 'deltAnterior'
  | 'deltLateral'
  | 'deltPosterior'
  | 'biceps'
  | 'triceps'
  | 'core'

export interface Profile {
  goal: Goal
  /** Optional for profiles created before the age question existed. */
  age?: AgeGroup
  experience: Experience
  situation: Situation
  days: number
  minutes: number
  equipment: Equipment
  injuries: Injury[]
  createdAt: string
}

export interface Exercise {
  id: string
  name: string
  slot: Slot
  kind: Kind
  equip: Equipment[]
  compound: boolean
  /** Movement pattern; decides how the sets count for each muscle (table 1b). */
  pattern: Pattern
  avoid?: Injury[]
  /** Main target of an isolation exercise; for compounds the pattern decides. */
  muscles?: Muscle[]
  /** One side at a time: a set takes twice as long (table 4b). */
  unilateral?: boolean
  coreType?: CoreType
  /** Timed hold: the "reps" are seconds. The generator does not pick these. */
  hold?: boolean
  /** Kept so saved plans still find it, but the generator does not pick it. */
  legacy?: boolean
  /** Created by the user. */
  custom?: boolean
  /** Placeholder for an id that is not in the library. */
  unknown?: boolean
}

/** An exercise the user adds when it is not in the library. */
export interface CustomExercise {
  id: string
  name: string
  kind: Kind
  muscle: Muscle
  compound: boolean
}

export interface PlanExercise {
  exerciseId: string
  slot: Slot
  role: Role
  sets: number
  repMin: number
  repMax: number
  rest: number
  /** Target reps in reserve at the end of each set (table 3). Missing in plans made before v0.5. */
  rir?: number
  /** Exercises sharing this letter are done as a superset, alternating sets (table 8b). */
  superset?: string
}

export interface PlanDay {
  id: string
  name: string
  focus: string
  exercises: PlanExercise[]
}

export interface Plan {
  name: string
  summary: string
  days: PlanDay[]
  /** True once the user replaced an exercise by hand. */
  edited?: boolean
  /** Built by the user from scratch ("Ya tengo un plan"). */
  custom?: boolean
}

export interface SetLog {
  weight: number
  reps: number
  done: boolean
}

export interface ExerciseLog {
  exerciseId: string
  repMin: number
  repMax: number
  sets: SetLog[]
  feel?: Feel
  /** Weight used before a break; while below it, the progression climbs back faster. */
  recoverTo?: number
}

export interface Session {
  id: string
  date: string
  dayId: string
  dayName: string
  exercises: ExerciseLog[]
}

export interface Settings {
  incBarra: number
  incMancuerna: number
  incMaquina: number
  /** How a session is shown: one exercise at a time, or all in a list. */
  sessionView: 'enfoque' | 'lista'
  /** Caps strength days by experience (table 5a); extra days are rest or cardio. Missing means on. */
  capStrengthDays?: boolean
}

export type PrescriptionMode =
  | 'calibracion'
  | 'subir'
  | 'mantener'
  | 'repetir'
  | 'bajar'
  | 'regreso'
  | 'ajuste'

export interface Prescription {
  mode: PrescriptionMode
  weight: number | null
  reps: number[]
  delta: number
  note: string
  last?: { date: string; log: ExerciseLog }
  /** Weight to climb back to after a break (saved with the session). */
  recoverTo?: number
}

export interface ActiveExercise {
  plan: PlanExercise
  exerciseId: string
  prescription: Prescription
  sets: SetLog[]
  feel?: Feel
}

export interface ActiveSession {
  id: string
  startedAt: string
  dayId: string
  dayName: string
  exercises: ActiveExercise[]
  /** Exercise shown in focus mode. */
  current?: number
  /** Rest running between sets. Saved so it survives the phone closing the app in the background. */
  rest?: RestState
}

export interface RestState {
  /** When the rest ends, in ms since epoch. The time left is always computed from this, never counted down. */
  endsAt: number
  /** Planned length in seconds, for the progress bar. */
  total: number
  label: string
}
