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

export type Muscle =
  | 'cuadriceps'
  | 'gluteo'
  | 'femoral'
  | 'gemelo'
  | 'pecho'
  | 'espalda'
  | 'hombro'
  | 'biceps'
  | 'triceps'

export interface Profile {
  goal: Goal
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
  avoid?: Injury[]
  /** Overrides the slot's default muscles; the first one is the main target. */
  muscles?: Muscle[]
  /** Created by the user. */
  custom?: boolean
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
}
