import { getExercise, isAvoided, listMuscles, MUSCLE_NAMES, musclesOf } from './exercises'
import type { Injury, Muscle, Plan } from './types'

export type SwapLevel = 'igual' | 'parecido' | 'distinto' | 'bloqueado'

export interface SwapCheck {
  level: SwapLevel
  /** One-line verdict shown above the confirm buttons. */
  title: string
  /** Extra warnings: muscles left without work, injuries. */
  warnings: string[]
}

const INJURY_NAMES: Record<Injury, string> = {
  hombro: 'el hombro',
  rodilla: 'la rodilla',
  espalda: 'la espalda baja',
}

/**
 * Compares replacing the exercise at plan.days[dayId].exercises[index] with `nextId`.
 * Checks the movement pattern, the muscles worked, what the whole week would lose, and injuries.
 */
export function checkSwap(plan: Plan, dayId: string, index: number, nextId: string, injuries: Injury[]): SwapCheck {
  const day = plan.days.find((d) => d.id === dayId)
  const slot = day?.exercises[index]
  if (!day || !slot) return { level: 'bloqueado', title: 'No encontramos ese ejercicio en tu rutina.', warnings: [] }

  const current = getExercise(slot.exerciseId)
  const next = getExercise(nextId)

  if (next.id === current.id) {
    return { level: 'bloqueado', title: 'Es el mismo ejercicio que ya tienes.', warnings: [] }
  }
  if (day.exercises.some((e, i) => i !== index && e.exerciseId === next.id)) {
    return { level: 'bloqueado', title: `${next.name} ya está en ${day.name}.`, warnings: [] }
  }

  const before = musclesOf(current)
  const after = musclesOf(next)
  const shared = before.filter((m) => after.includes(m))

  let level: SwapLevel
  let title: string
  if (next.slot === current.slot) {
    level = 'igual'
    title = `Trabaja la misma zona (${listMuscles([before[0]])}) con un movimiento equivalente.`
  } else if (shared.includes(before[0]) || shared.includes(after[0])) {
    level = 'parecido'
    title = `Trabaja una zona parecida (${listMuscles(shared)}), pero con otro tipo de movimiento.`
  } else if (shared.length > 0) {
    level = 'parecido'
    title = `Comparten algo de trabajo (${listMuscles(shared)}), pero el foco principal cambia de ${MUSCLE_NAMES[before[0]]} a ${MUSCLE_NAMES[after[0]]}.`
  } else {
    level = 'distinto'
    title = `No trabaja la misma zona: ${current.name} trabaja ${listMuscles(before)} y ${next.name} trabaja ${listMuscles(after)}.`
  }

  const warnings: string[] = []

  // Main muscles that would lose all direct work during the week.
  const weekAfter = new Set<Muscle>()
  plan.days.forEach((d) =>
    d.exercises.forEach((e, i) => {
      const id = d.id === dayId && i === index ? next.id : e.exerciseId
      musclesOf(getExercise(id)).slice(0, 2).forEach((m) => weekAfter.add(m))
    }),
  )
  const lost = before.slice(0, 2).filter((m) => !weekAfter.has(m))
  if (lost.length > 0) {
    warnings.push(`Tu rutina quedaría sin ejercicios para ${listMuscles(lost)} en toda la semana.`)
  }

  if (current.compound && !next.compound && slot.role !== 'accesorio') {
    warnings.push(`Reemplazas un ejercicio básico por uno de aislamiento: progresarás más lento en fuerza general.`)
  }

  const risky = isAvoided(next, injuries)
  if (risky.length > 0) {
    warnings.push(`Suele cargar ${risky.map((i) => INJURY_NAMES[i]).join(' y ')}, donde marcaste molestias.`)
  }

  return { level, title, warnings }
}

/** Muscles that would lose all weekly work if the exercise at that position were removed. */
export function checkRemoval(plan: Plan, dayId: string, index: number): string[] {
  const day = plan.days.find((d) => d.id === dayId)
  const target = day?.exercises[index]
  if (!day || !target) return []
  const warnings: string[] = []
  if (day.exercises.length === 1) warnings.push(`Es el único ejercicio de ${day.name}.`)
  const remaining = new Set<Muscle>()
  plan.days.forEach((d) =>
    d.exercises.forEach((e, i) => {
      if (d.id === dayId && i === index) return
      musclesOf(getExercise(e.exerciseId)).slice(0, 2).forEach((m) => remaining.add(m))
    }),
  )
  const lost = musclesOf(getExercise(target.exerciseId)).slice(0, 2).filter((m) => !remaining.has(m))
  if (lost.length > 0) warnings.push(`Tu rutina quedaría sin ejercicios para ${listMuscles(lost)} en toda la semana.`)
  return warnings
}
