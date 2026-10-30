import { describe, expect, it } from 'vitest'
import { cleanEdited, lastTrainedAt, nextDay, prepareExercise, toSession } from './session'
import type { ActiveSession, Plan, PlanExercise, Session, Settings } from './types'

const settings: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'enfoque' }
const bench: PlanExercise = { exerciseId: 'banca-barra', slot: 'pressHorizontal', role: 'principal', sets: 3, repMin: 8, repMax: 12, rest: 150 }
const row: PlanExercise = { exerciseId: 'remo-barra', slot: 'remo', role: 'secundario', sets: 3, repMin: 8, repMax: 12, rest: 120 }

const plan: Plan = {
  name: 'Prueba',
  summary: '',
  days: [
    { id: 'd1', name: 'Día 1', focus: '', exercises: [bench] },
    { id: 'd2', name: 'Día 2', focus: '', exercises: [row] },
    { id: 'd3', name: 'Día 3', focus: '', exercises: [bench, row] },
  ],
}

function session(id: string, dayId: string, date: string): Session {
  return {
    id,
    date,
    dayId,
    dayName: dayId,
    exercises: [{ exerciseId: 'banca-barra', repMin: 8, repMax: 12, sets: [{ weight: 50, reps: 10, done: true }] }],
  }
}

describe('nextDay', () => {
  it('starts with the first day', () => {
    expect(nextDay(plan, [])?.id).toBe('d1')
  })

  it('follows the rotation and wraps around', () => {
    expect(nextDay(plan, [session('a', 'd1', '2026-01-01')])?.id).toBe('d2')
    expect(nextDay(plan, [session('a', 'd3', '2026-01-01')])?.id).toBe('d1')
  })

  it('skips sessions of days that were removed instead of going back to day 1', () => {
    const sessions = [session('a', 'd2', '2026-01-01'), session('b', 'old', '2026-01-03')]
    expect(nextDay(plan, sessions)?.id).toBe('d3')
  })

  it('returns nothing for a plan without days', () => {
    expect(nextDay({ ...plan, days: [] }, [])).toBeUndefined()
  })
})

describe('lastTrainedAt', () => {
  it('finds the most recent date even if sessions are out of order', () => {
    const sessions = [session('a', 'd1', '2026-01-05T10:00:00Z'), session('b', 'd2', '2026-01-02T10:00:00Z')]
    expect(lastTrainedAt(sessions)).toBe('2026-01-05T10:00:00Z')
    expect(lastTrainedAt([])).toBeUndefined()
  })
})

function active(): ActiveSession {
  const a = prepareExercise({ sessions: [], settings }, bench, 'banca-barra')
  const b = prepareExercise({ sessions: [], settings }, row, 'remo-barra')
  return { id: 's1', startedAt: '2026-01-01T10:00:00Z', dayId: 'd3', dayName: 'Día 3', exercises: [a, b] }
}

describe('prepareExercise', () => {
  it('starts calibration with empty reps so the user logs what they did', () => {
    const ex = prepareExercise({ sessions: [], settings }, bench, 'banca-barra')
    expect(ex.prescription.mode).toBe('calibracion')
    expect(ex.sets).toEqual([
      { weight: 0, reps: 0, done: false },
      { weight: 0, reps: 0, done: false },
      { weight: 0, reps: 0, done: false },
    ])
  })

  it('pre-fills weight and reps from the prescription', () => {
    const ex = prepareExercise({ sessions: [session('a', 'd1', '2026-01-01T10:00:00Z')], settings }, bench, 'banca-barra', new Date('2026-01-03T10:00:00Z'))
    expect(ex.sets).toEqual([
      { weight: 50, reps: 11, done: false },
      { weight: 50, reps: 11, done: false },
      { weight: 50, reps: 11, done: false },
    ])
  })
})

describe('toSession', () => {
  it('keeps only sets marked as done and exercises with at least one', () => {
    const a = active()
    a.exercises[0].sets = [
      { weight: 50, reps: 10, done: true },
      { weight: 50, reps: 9, done: false },
      { weight: 50, reps: 0, done: true },
    ]
    a.exercises[0].feel = 'justo'
    const s = toSession(a, new Date('2026-01-01T11:00:00Z'))!
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0]).toEqual({ exerciseId: 'banca-barra', repMin: 8, repMax: 12, feel: 'justo', sets: [{ weight: 50, reps: 10, done: true }] })
    expect(s.date).toBe('2026-01-01T11:00:00.000Z')
  })

  it('returns null when nothing was done', () => {
    expect(toSession(active())).toBeNull()
  })

  it('saves the weight to climb back to after a break', () => {
    const a = active()
    a.exercises[0].prescription = { ...a.exercises[0].prescription, mode: 'regreso', recoverTo: 60 }
    a.exercises[0].sets[0] = { weight: 47.5, reps: 8, done: true }
    expect(toSession(a)!.exercises[0].recoverTo).toBe(60)
  })
})

describe('cleanEdited', () => {
  it('drops sets without reps and exercises without sets', () => {
    const s = session('a', 'd1', '2026-01-01')
    s.exercises.push({ exerciseId: 'remo-barra', repMin: 8, repMax: 12, sets: [{ weight: 40, reps: 0, done: true }] })
    s.exercises[0].sets.push({ weight: 50, reps: 0, done: true })
    const clean = cleanEdited(s)!
    expect(clean.exercises).toHaveLength(1)
    expect(clean.exercises[0].sets).toHaveLength(1)
  })

  it('returns null for a session left empty, so it is removed', () => {
    const s = session('a', 'd1', '2026-01-01')
    s.exercises[0].sets[0].reps = 0
    expect(cleanEdited(s)).toBeNull()
  })
})
