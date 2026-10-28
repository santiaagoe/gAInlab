import { getExercise } from './exercises'
import { entryFor } from './plan'
import type { Plan, PlanDay, PlanExercise, Profile } from './types'

/** Pure plan edits. Every function returns a new plan marked as edited. */

export type ExercisePatch = Partial<Pick<PlanExercise, 'sets' | 'repMin' | 'repMax' | 'rest'>>

function mapDay(plan: Plan, dayId: string, fn: (day: PlanDay) => PlanDay): Plan {
  return { ...plan, edited: true, days: plan.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

export function replaceExercise(plan: Plan, dayId: string, index: number, exerciseId: string): Plan {
  const slot = getExercise(exerciseId).slot
  return mapDay(plan, dayId, (d) => ({
    ...d,
    exercises: d.exercises.map((e, i) => (i === index ? { ...e, exerciseId, slot } : e)),
  }))
}

export function updateExercise(plan: Plan, dayId: string, index: number, patch: ExercisePatch): Plan {
  return mapDay(plan, dayId, (d) => ({
    ...d,
    exercises: d.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
  }))
}

export function removeExercise(plan: Plan, dayId: string, index: number): Plan {
  return mapDay(plan, dayId, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== index) }))
}

export function addExercise(plan: Plan, dayId: string, exerciseId: string, profile: Profile): Plan {
  const entry = entryFor(profile, getExercise(exerciseId))
  return mapDay(plan, dayId, (d) => ({ ...d, exercises: [...d.exercises, entry] }))
}

export function moveExercise(plan: Plan, dayId: string, index: number, delta: -1 | 1): Plan {
  return mapDay(plan, dayId, (d) => {
    const to = index + delta
    if (to < 0 || to >= d.exercises.length) return d
    const exercises = [...d.exercises]
    ;[exercises[index], exercises[to]] = [exercises[to], exercises[index]]
    return { ...d, exercises }
  })
}

export function renameDay(plan: Plan, dayId: string, name: string): Plan {
  const clean = name.trim()
  if (!clean) return plan
  return mapDay(plan, dayId, (d) => ({ ...d, name: clean }))
}

export function addDay(plan: Plan): Plan {
  const used = new Set(plan.days.map((d) => d.id))
  let n = plan.days.length + 1
  while (used.has(`d${n}`)) n++
  const day: PlanDay = { id: `d${n}`, name: `Día ${plan.days.length + 1}`, focus: '', exercises: [] }
  return { ...plan, edited: true, days: [...plan.days, day] }
}

export function removeDay(plan: Plan, dayId: string): Plan {
  if (plan.days.length <= 1) return plan
  return { ...plan, edited: true, days: plan.days.filter((d) => d.id !== dayId) }
}

/** Empty plan with one day per training day, for users who bring their own routine. */
export function emptyPlan(days: number): Plan {
  return {
    name: 'Mi plan',
    summary: 'Tu propia rutina. gAInlab calcula el peso y las repeticiones de cada sesión a partir de lo que anotas.',
    custom: true,
    days: Array.from({ length: days }, (_, i) => ({ id: `d${i + 1}`, name: `Día ${i + 1}`, focus: '', exercises: [] })),
  }
}

/** Days without exercises, which block starting with the plan. */
export function emptyDays(plan: Plan): PlanDay[] {
  return plan.days.filter((d) => d.exercises.length === 0)
}

/** Short description of a day from its first exercises, used where a template focus is missing. */
export function dayFocus(day: PlanDay): string {
  if (day.focus) return day.focus
  const names = day.exercises.slice(0, 2).map((e) => getExercise(e.exerciseId).name)
  if (names.length === 0) return 'Sin ejercicios'
  return day.exercises.length > 2 ? `${names.join(', ')} y ${day.exercises.length - 2} más` : names.join(' y ')
}
