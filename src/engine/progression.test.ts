import { describe, expect, it } from 'vitest'
import { buildPlan } from './plan'
import { getExercise } from './exercises'
import { prescribe, roundDown, roundTo, type HistoryEntry } from './progression'
import type { ExerciseLog, Feel, PlanExercise, Profile, Settings } from './types'

const settings: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5 }
const bench: PlanExercise = {
  exerciseId: 'banca-barra',
  slot: 'pressHorizontal',
  role: 'principal',
  sets: 3,
  repMin: 8,
  repMax: 12,
  rest: 150,
}
const now = new Date('2026-11-10T12:00:00Z')

function entry(daysAgo: number, weight: number, reps: number[], feel?: Feel): HistoryEntry {
  const log: ExerciseLog = {
    exerciseId: bench.exerciseId,
    repMin: 8,
    repMax: 12,
    feel,
    sets: reps.map((r) => ({ weight, reps: r, done: true })),
  }
  return { date: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), log }
}

describe('prescribe', () => {
  it('asks for calibration without history', () => {
    const p = prescribe(bench, [], settings, now)
    expect(p.mode).toBe('calibracion')
    expect(p.weight).toBeNull()
  })

  it('keeps the weight and adds a rep per set inside the range', () => {
    const p = prescribe(bench, [entry(2, 50, [10, 9, 8], 'justo')], settings, now)
    expect(p.mode).toBe('mantener')
    expect(p.weight).toBe(50)
    expect(p.reps).toEqual([11, 10, 9])
  })

  it('consolidates reps after a set taken to the limit', () => {
    const p = prescribe(bench, [entry(2, 50, [10, 9, 8], 'limite')], settings, now)
    expect(p.reps).toEqual([10, 9, 8])
  })

  it('raises the weight and resets reps once every set hits the top', () => {
    const p = prescribe(bench, [entry(2, 50, [12, 12, 12], 'justo')], settings, now)
    expect(p.mode).toBe('subir')
    expect(p.weight).toBe(52.5)
    expect(p.reps).toEqual([8, 8, 8])
  })

  it('jumps two steps on a compound lift that felt easy', () => {
    const p = prescribe(bench, [entry(2, 50, [12, 12, 12], 'facil')], settings, now)
    expect(p.weight).toBe(55)
  })

  it('repeats the weight after one session below range, deloads after two', () => {
    const once = prescribe(bench, [entry(4, 50, [8, 7, 6])], settings, now)
    expect(once.mode).toBe('repetir')
    expect(once.weight).toBe(50)
    const twice = prescribe(bench, [entry(4, 50, [8, 7, 6]), entry(2, 50, [7, 6, 6])], settings, now)
    expect(twice.mode).toBe('bajar')
    expect(twice.weight).toBe(45)
  })

  it('recalibrates when a calibration weight was far too light', () => {
    const p = prescribe(bench, [entry(2, 40, [20, 18, 16], 'facil')], settings, now)
    expect(p.mode).toBe('ajuste')
    expect(p.weight!).toBeGreaterThan(40)
    expect(p.weight! % 2.5).toBe(0)
  })

  it('applies return mode after a long gap', () => {
    const p = prescribe(bench, [entry(35, 60, [10, 10, 10])], settings, now)
    expect(p.mode).toBe('regreso')
    expect(p.weight).toBe(47.5)
  })
})

describe('rounding', () => {
  it('rounds to real plate increments', () => {
    expect(roundTo(51.3, 2.5)).toBe(52.5)
    expect(roundDown(51.3, 2.5)).toBe(50)
    expect(roundTo(13, 2)).toBe(14)
  })
})

describe('buildPlan', () => {
  const base: Profile = {
    goal: 'hipertrofia',
    experience: 'menos1',
    situation: 'regreso',
    days: 3,
    minutes: 60,
    equipment: 'gimnasio',
    injuries: [],
    createdAt: now.toISOString(),
  }

  it('builds one day per training day with unique exercises', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const plan = buildPlan({ ...base, days })
      expect(plan.days).toHaveLength(days)
      for (const day of plan.days) {
        const ids = day.exercises.map((e) => e.exerciseId)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.length).toBeGreaterThan(0)
      }
    }
  })

  it('respects time limits and equipment', () => {
    const plan = buildPlan({ ...base, minutes: 30, equipment: 'casa' })
    for (const day of plan.days) {
      expect(day.exercises.length).toBeLessThanOrEqual(3)
      for (const e of day.exercises) expect(getExercise(e.exerciseId).equip).toContain('casa')
    }
  })

  it('avoids exercises flagged for injuries', () => {
    const plan = buildPlan({ ...base, injuries: ['hombro', 'espalda', 'rodilla'] })
    for (const day of plan.days) {
      for (const e of day.exercises) {
        const avoid = getExercise(e.exerciseId).avoid ?? []
        expect(avoid.some((i) => ['hombro', 'espalda', 'rodilla'].includes(i))).toBe(false)
      }
    }
  })

  it('uses low reps for strength', () => {
    const plan = buildPlan({ ...base, goal: 'fuerza' })
    const main = plan.days[0].exercises[0]
    expect(main.repMax).toBeLessThanOrEqual(6)
  })
})
