import { describe, expect, it } from 'vitest'
import { ageRules, ageSummary } from './age'
import { getExercise } from './exercises'
import { buildPlan } from './plan'
import { prescribe, warmupSets, type HistoryEntry } from './progression'
import type { AgeGroup, ExerciseLog, Feel, PlanExercise, Profile, Settings } from './types'

const settings: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'enfoque' }
const now = new Date('2026-11-10T12:00:00Z')
const bench: PlanExercise = {
  exerciseId: 'banca-barra',
  slot: 'pressHorizontal',
  role: 'principal',
  sets: 3,
  repMin: 8,
  repMax: 12,
  rest: 150,
}

function entry(daysAgo: number, weight: number, reps: number[], feel?: Feel): HistoryEntry {
  const log: ExerciseLog = { exerciseId: 'banca-barra', repMin: 8, repMax: 12, feel, sets: reps.map((r) => ({ weight, reps: r, done: true })) }
  return { date: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), log }
}

const profile = (age?: AgeGroup, extra: Partial<Profile> = {}): Profile => ({
  goal: 'hipertrofia',
  experience: 'menos1',
  situation: 'entreno',
  days: 3,
  minutes: 60,
  equipment: 'gimnasio',
  injuries: [],
  createdAt: now.toISOString(),
  age,
  ...extra,
})

describe('age in progression', () => {
  it('only younger lifters get the double jump on an easy session', () => {
    const h = [entry(2, 50, [12, 12, 12], 'facil')]
    expect(prescribe(bench, h, settings, now, '30-39').weight).toBe(55)
    expect(prescribe(bench, h, settings, now, '50-59').weight).toBe(52.5)
    expect(prescribe(bench, h, settings, now, 'menor').weight).toBe(52.5)
  })

  it('older lifters consolidate once after reaching the top at their limit', () => {
    const once = prescribe(bench, [entry(2, 50, [12, 12, 12], 'limite')], settings, now, '60-69')
    expect(once.mode).toBe('mantener')
    expect(once.weight).toBe(50)
    const twice = prescribe(bench, [entry(4, 50, [12, 12, 12], 'limite'), entry(2, 50, [12, 12, 12], 'limite')], settings, now, '60-69')
    expect(twice.mode).toBe('subir')
    // Younger lifters go up straight away.
    expect(prescribe(bench, [entry(2, 50, [12, 12, 12], 'limite')], settings, now, '18-29').mode).toBe('subir')
  })

  it('return mode starts earlier and is more cautious with age', () => {
    const h = [entry(11, 60, [10, 10, 10], 'justo')]
    expect(prescribe(bench, h, settings, now, '30-39').mode).toBe('mantener')
    expect(prescribe(bench, h, settings, now, '70+').mode).toBe('regreso')
    const long = [entry(35, 60, [10, 10, 10])]
    expect(prescribe(bench, long, settings, now, '30-39').weight).toBe(47.5)
    expect(prescribe(bench, long, settings, now, '60-69').weight).toBe(45)
  })

  it('keeps standard behaviour without an age', () => {
    expect(ageRules(undefined)).toEqual(ageRules('30-39'))
    expect(ageSummary(undefined)).toBeNull()
  })
})

describe('age in plans', () => {
  it('raises strength rep ranges and caps main sets for older and younger lifters', () => {
    const strong = buildPlan(profile('60-69', { goal: 'fuerza', experience: 'mas1' }))
    const main = strong.days[0].exercises[0]
    expect(main.repMin).toBeGreaterThanOrEqual(8)
    expect(main.sets).toBeLessThanOrEqual(3)
    const teen = buildPlan(profile('menor', { goal: 'fuerza' }))
    expect(teen.days[0].exercises[0].repMin).toBeGreaterThanOrEqual(6)
    const adult = buildPlan(profile('30-39', { goal: 'fuerza' }))
    expect(adult.days[0].exercises[0].repMin).toBe(4)
  })

  it('adds rest between sets with age', () => {
    const young = buildPlan(profile('18-29')).days[0].exercises[0].rest
    const older = buildPlan(profile('50-59')).days[0].exercises[0].rest
    expect(older).toBe(young + 30)
  })

  it('swaps technical barbell lifts for machines or dumbbells for older beginners', () => {
    const plan = buildPlan(profile('60-69'))
    const squat = plan.days[0].exercises.find((e) => e.slot === 'sentadilla')!
    expect(getExercise(squat.exerciseId).kind).not.toBe('barra')
    const experienced = buildPlan(profile('60-69', { experience: 'mas1' }))
    expect(experienced.days[0].exercises[0].exerciseId).toBe('sentadilla-barra')
  })

  it('explains the age adjustments in the summary', () => {
    expect(buildPlan(profile('60-69')).summary).toMatch(/consulta antes con un profesional/)
    expect(buildPlan(profile('18-29')).summary).not.toMatch(/edad/)
    expect(buildPlan(profile('60-69', { goal: 'fuerza' })).summary).not.toMatch(/pocas repeticiones/)
  })
})

describe('age in warm-ups', () => {
  it('avoids heavy singles and adds a lighter set for older lifters', () => {
    expect(warmupSets(100, 'barra', 2.5, '30-39').at(-1)).toEqual({ weight: 85, reps: 1 })
    expect(warmupSets(100, 'barra', 2.5, '60-69').at(-1)).toEqual({ weight: 80, reps: 2 })
    expect(warmupSets(80, 'maquina', 5, '60-69')[0]).toEqual({ weight: 20, reps: 12 })
  })
})
