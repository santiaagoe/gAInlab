import { optionsForSlot } from './exercises'
import type { Exercise, Goal, Plan, PlanDay, PlanExercise, Profile, Role, Slot } from './types'

interface SlotSpec {
  slot: Slot
  role: Role
  /** 0 = first choice, 1 = second choice (adds variety between days) */
  variant?: number
}

interface DayTemplate {
  name: string
  focus: string
  slots: SlotSpec[]
}

const M = 'principal' as const
const S = 'secundario' as const
const A = 'accesorio' as const

const FULL_A: DayTemplate = {
  name: 'Full body A',
  focus: 'Sentadilla y press banca',
  slots: [
    { slot: 'sentadilla', role: M },
    { slot: 'pressHorizontal', role: M },
    { slot: 'remo', role: S },
    { slot: 'lateral', role: A },
    { slot: 'biceps', role: A },
    { slot: 'gemelo', role: A },
  ],
}
const FULL_B: DayTemplate = {
  name: 'Full body B',
  focus: 'Bisagra y press de hombro',
  slots: [
    { slot: 'bisagra', role: M },
    { slot: 'pressVertical', role: M },
    { slot: 'jalon', role: S },
    { slot: 'unilateral', role: A },
    { slot: 'triceps', role: A },
    { slot: 'pecho', role: A },
  ],
}
const FULL_C: DayTemplate = {
  name: 'Full body C',
  focus: 'Variantes de pierna y empuje',
  slots: [
    { slot: 'sentadilla', role: M, variant: 1 },
    { slot: 'pressHorizontal', role: M, variant: 1 },
    { slot: 'jalon', role: S, variant: 1 },
    { slot: 'femoral', role: A },
    { slot: 'lateral', role: A },
    { slot: 'triceps', role: A, variant: 1 },
  ],
}

const TORSO_A: DayTemplate = {
  name: 'Torso A',
  focus: 'Press banca y remo',
  slots: [
    { slot: 'pressHorizontal', role: M },
    { slot: 'remo', role: M },
    { slot: 'pressVertical', role: S },
    { slot: 'jalon', role: S },
    { slot: 'lateral', role: A },
    { slot: 'biceps', role: A },
    { slot: 'triceps', role: A },
  ],
}
const PIERNA_A: DayTemplate = {
  name: 'Pierna A',
  focus: 'Sentadilla',
  slots: [
    { slot: 'sentadilla', role: M },
    { slot: 'bisagra', role: S },
    { slot: 'unilateral', role: A },
    { slot: 'cuadriceps', role: A },
    { slot: 'gemelo', role: A },
  ],
}
const TORSO_B: DayTemplate = {
  name: 'Torso B',
  focus: 'Press de hombro y jalón',
  slots: [
    { slot: 'pressVertical', role: M },
    { slot: 'jalon', role: M },
    { slot: 'pressHorizontal', role: S, variant: 1 },
    { slot: 'remo', role: S, variant: 1 },
    { slot: 'pecho', role: A },
    { slot: 'biceps', role: A, variant: 1 },
    { slot: 'triceps', role: A, variant: 1 },
  ],
}
const PIERNA_B: DayTemplate = {
  name: 'Pierna B',
  focus: 'Bisagra de cadera',
  slots: [
    { slot: 'bisagra', role: M },
    { slot: 'sentadilla', role: S, variant: 1 },
    { slot: 'femoral', role: A },
    { slot: 'unilateral', role: A, variant: 1 },
    { slot: 'gemelo', role: A },
  ],
}
const EMPUJE: DayTemplate = {
  name: 'Empuje',
  focus: 'Pecho, hombro y tríceps',
  slots: [
    { slot: 'pressHorizontal', role: M },
    { slot: 'pressVertical', role: S },
    { slot: 'pressHorizontal', role: S, variant: 1 },
    { slot: 'lateral', role: A },
    { slot: 'pecho', role: A },
    { slot: 'triceps', role: A },
  ],
}
const TIRON: DayTemplate = {
  name: 'Tirón',
  focus: 'Espalda y bíceps',
  slots: [
    { slot: 'jalon', role: M },
    { slot: 'remo', role: M },
    { slot: 'remo', role: S, variant: 1 },
    { slot: 'femoral', role: A },
    { slot: 'biceps', role: A },
    { slot: 'biceps', role: A, variant: 1 },
  ],
}
const EMPUJE_B: DayTemplate = {
  ...EMPUJE,
  name: 'Empuje B',
  focus: 'Hombro y pecho inclinado',
  slots: [
    { slot: 'pressVertical', role: M },
    { slot: 'pressHorizontal', role: S, variant: 1 },
    { slot: 'pecho', role: A },
    { slot: 'lateral', role: A },
    { slot: 'triceps', role: A, variant: 1 },
  ],
}
const TIRON_B: DayTemplate = {
  name: 'Tirón B',
  focus: 'Remo y jalón',
  slots: [
    { slot: 'remo', role: M },
    { slot: 'jalon', role: S, variant: 1 },
    { slot: 'bisagra', role: S },
    { slot: 'biceps', role: A, variant: 1 },
    { slot: 'lateral', role: A },
  ],
}

const SPLITS: Record<number, { name: string; days: DayTemplate[] }> = {
  2: { name: 'Full body, 2 días', days: [FULL_A, FULL_B] },
  3: { name: 'Full body, 3 días', days: [FULL_A, FULL_B, FULL_C] },
  4: { name: 'Torso y pierna, 4 días', days: [TORSO_A, PIERNA_A, TORSO_B, PIERNA_B] },
  5: { name: 'Torso, pierna, empuje y tirón, 5 días', days: [TORSO_A, PIERNA_A, EMPUJE, TIRON, PIERNA_B] },
  6: { name: 'Empuje, tirón y pierna, 6 días', days: [EMPUJE, TIRON, PIERNA_A, EMPUJE_B, TIRON_B, PIERNA_B] },
}

export interface Dose {
  sets: number
  repMin: number
  repMax: number
  rest: number
}

const DOSES: Record<Goal, Record<Role, Dose>> = {
  hipertrofia: {
    principal: { sets: 3, repMin: 8, repMax: 12, rest: 150 },
    secundario: { sets: 3, repMin: 8, repMax: 12, rest: 120 },
    accesorio: { sets: 3, repMin: 10, repMax: 15, rest: 75 },
  },
  grasa: {
    principal: { sets: 3, repMin: 8, repMax: 12, rest: 120 },
    secundario: { sets: 3, repMin: 10, repMax: 12, rest: 90 },
    accesorio: { sets: 2, repMin: 12, repMax: 15, rest: 60 },
  },
  fuerza: {
    principal: { sets: 4, repMin: 4, repMax: 6, rest: 180 },
    secundario: { sets: 3, repMin: 6, repMax: 8, rest: 150 },
    accesorio: { sets: 3, repMin: 8, repMax: 12, rest: 90 },
  },
  salud: {
    principal: { sets: 2, repMin: 8, repMax: 12, rest: 120 },
    secundario: { sets: 2, repMin: 10, repMax: 12, rest: 90 },
    accesorio: { sets: 2, repMin: 12, repMax: 15, rest: 60 },
  },
}

export function maxExercisesFor(minutes: number): number {
  if (minutes <= 30) return 3
  if (minutes <= 45) return 4
  if (minutes <= 60) return 5
  if (minutes <= 75) return 6
  return 7
}

export function doseFor(profile: Profile, role: Role): Dose {
  const base = { ...DOSES[profile.goal][role] }
  if (profile.experience === 'nuevo') {
    base.sets = Math.min(base.sets, role === 'principal' ? 3 : 2)
  }
  if (profile.experience === 'mas1' && role === 'principal' && profile.goal !== 'salud') {
    base.sets = Math.min(base.sets + 1, 5)
  }
  if (profile.minutes <= 30 && role === 'accesorio') base.sets = Math.min(base.sets, 2)
  return base
}

export function buildPlan(profile: Profile): Plan {
  const days = Math.min(6, Math.max(2, profile.days))
  const split = SPLITS[days]
  const limit = maxExercisesFor(profile.minutes)

  const planDays: PlanDay[] = split.days.map((tpl, index) => {
    const used = new Set<string>()
    const exercises: PlanExercise[] = []
    for (const spec of tpl.slots) {
      if (exercises.length >= limit) break
      const options = optionsForSlot(spec.slot, profile.equipment, profile.injuries).filter(
        (e) => !used.has(e.id),
      )
      if (options.length === 0) continue
      const pick = options[Math.min(spec.variant ?? 0, options.length - 1)]
      used.add(pick.id)
      const dose = doseFor(profile, spec.role)
      exercises.push({ exerciseId: pick.id, slot: spec.slot, role: spec.role, ...dose })
    }
    return { id: `d${index + 1}`, name: tpl.name, focus: tpl.focus, exercises }
  })

  return {
    name: split.name,
    summary: summaryFor(profile),
    days: planDays,
  }
}

const GOAL_TEXT: Record<Goal, string> = {
  hipertrofia: 'Enfocado en ganar músculo: series de 8 a 12 repeticiones en los ejercicios principales y más volumen en los accesorios.',
  grasa: 'Pensado para perder grasa sin perder fuerza: mantienes pesos exigentes en los básicos y descansos más cortos en los accesorios.',
  fuerza: 'Enfocado en fuerza: pocas repeticiones y descansos largos en los básicos, que es donde más vas a progresar.',
  salud: 'Volumen moderado para entrenar con constancia: cubre todo el cuerpo sin agotarte.',
}

function summaryFor(profile: Profile): string {
  const parts = [GOAL_TEXT[profile.goal]]
  if (profile.situation === 'regreso') {
    parts.push('Como vuelves de una pausa, la primera sesión de cada ejercicio sirve para calibrar con pesos cómodos.')
  }
  if (profile.injuries.length > 0) {
    parts.push('Evitamos los ejercicios que suelen cargar las zonas donde tienes molestias.')
  }
  return parts.join(' ')
}

/** Plan entry for an exercise the user adds by hand: compounds as secondary work, the rest as accessories. */
export function entryFor(profile: Profile, exercise: Exercise): PlanExercise {
  const role: Role = exercise.compound ? 'secundario' : 'accesorio'
  return { exerciseId: exercise.id, slot: exercise.slot, role, ...doseFor(profile, role) }
}
