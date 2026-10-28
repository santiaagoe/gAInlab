import { describe, expect, it } from 'vitest'
import { allExercises, getExercise, registerCustomExercises } from './exercises'
import { buildPlan } from './plan'
import {
  addDay,
  addExercise,
  dayFocus,
  emptyDays,
  emptyPlan,
  moveExercise,
  removeDay,
  removeExercise,
  renameDay,
  replaceExercise,
  updateExercise,
} from './planEdit'
import { checkSwap } from './swap'
import type { Profile } from './types'

const profile: Profile = {
  goal: 'hipertrofia',
  experience: 'menos1',
  situation: 'regreso',
  days: 3,
  minutes: 60,
  equipment: 'gimnasio',
  injuries: [],
  createdAt: '2026-10-28T00:00:00Z',
}

describe('plan edits', () => {
  const plan = buildPlan(profile)

  it('replaces and updates without touching other days', () => {
    const p = updateExercise(replaceExercise(plan, 'd1', 1, 'press-pecho-maquina'), 'd1', 1, { sets: 4 })
    expect(p.days[0].exercises[1]).toMatchObject({ exerciseId: 'press-pecho-maquina', sets: 4, slot: 'pressHorizontal' })
    expect(p.days[1]).toBe(plan.days[1])
    expect(p.edited).toBe(true)
    expect(plan.edited).toBeUndefined()
  })

  it('adds with a default dose, moves and removes', () => {
    let p = addExercise(plan, 'd1', 'curl-martillo', profile)
    const last = p.days[0].exercises.at(-1)!
    expect(last).toMatchObject({ exerciseId: 'curl-martillo', role: 'accesorio', repMin: 10, repMax: 15 })
    p = moveExercise(p, 'd1', p.days[0].exercises.length - 1, -1)
    expect(p.days[0].exercises.at(-2)!.exerciseId).toBe('curl-martillo')
    p = removeExercise(p, 'd1', p.days[0].exercises.length - 2)
    expect(p.days[0].exercises.some((e) => e.exerciseId === 'curl-martillo')).toBe(false)
  })

  it('adds, renames and removes days but never the last one', () => {
    let p = addDay(emptyPlan(1))
    expect(p.days.map((d) => d.id)).toEqual(['d1', 'd2'])
    p = renameDay(p, 'd2', '  Pierna  ')
    expect(p.days[1].name).toBe('Pierna')
    expect(renameDay(p, 'd2', '   ').days[1].name).toBe('Pierna')
    p = removeDay(p, 'd1')
    expect(p.days).toHaveLength(1)
    expect(removeDay(p, 'd2').days).toHaveLength(1)
  })

  it('reports empty days and describes days without a template focus', () => {
    let p = emptyPlan(2)
    expect(emptyDays(p)).toHaveLength(2)
    p = addExercise(p, 'd1', 'banca-barra', profile)
    p = addExercise(p, 'd1', 'remo-barra', profile)
    p = addExercise(p, 'd1', 'curl-barra', profile)
    expect(emptyDays(p).map((d) => d.id)).toEqual(['d2'])
    expect(dayFocus(p.days[0])).toBe('Press banca con barra, Remo con barra y 1 más')
  })
})

describe('custom exercises', () => {
  it('registers user exercises and compares them by muscle', () => {
    registerCustomExercises([{ id: 'custom-1', name: 'Press Hammer', kind: 'maquina', muscle: 'pecho', compound: true }])
    expect(getExercise('custom-1').name).toBe('Press Hammer')
    expect(allExercises()[0].id).toBe('custom-1')
    const plan = buildPlan(profile)
    const check = checkSwap(plan, 'd1', 1, 'custom-1', [])
    expect(check.level).toBe('parecido')
    registerCustomExercises([])
    expect(allExercises().some((e) => e.id === 'custom-1')).toBe(false)
  })
})
