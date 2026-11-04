import { describe, expect, it } from 'vitest'
import { overallProgress } from './overall'
import type { Session } from './types'

let n = 0
function session(date: string, logs: [string, number, number][]): Session {
  return {
    id: `s${n++}`,
    date,
    dayId: 'd1',
    dayName: 'Día 1',
    exercises: logs.map(([exerciseId, weight, reps]) => ({
      exerciseId,
      repMin: 8,
      repMax: 12,
      sets: [{ weight, reps, done: true }],
    })),
  }
}

// Mondays, local time, at noon so no time zone moves them to another week.
const W1 = '2026-01-05T12:00:00'
const W1b = '2026-01-08T12:00:00'
const W2 = '2026-01-12T12:00:00'
const W4 = '2026-01-26T12:00:00'

describe('overallProgress', () => {
  it('is empty without sessions', () => {
    const r = overallProgress([])
    expect(r.points).toEqual([])
    expect(r.changes).toEqual([])
    expect([r.up, r.flat, r.down]).toEqual([0, 0, 0])
  })

  it('starts at 100 and compares each exercise with its own start, whatever the weight', () => {
    const r = overallProgress([
      session(W1, [
        ['sentadilla-barra', 80, 10],
        ['curl-mancuernas', 10, 10],
      ]),
      // Squat +10% (88 kg), curl +20% (12 kg): the average is +15%, the light exercise counts as much.
      session(W2, [
        ['sentadilla-barra', 88, 10],
        ['curl-mancuernas', 12, 10],
      ]),
    ])
    expect(r.points.map((p) => p.index)).toEqual([100, 115])
    expect(r.points[1].exercises).toBe(2)
  })

  it('uses the latest session of each exercise up to that week, and one point per week', () => {
    const r = overallProgress([
      session(W1, [['sentadilla-barra', 80, 10]]),
      session(W1b, [['sentadilla-barra', 84, 10]]),
      session(W4, [['sentadilla-barra', 88, 10]]),
    ])
    expect(r.points.map((p) => p.index)).toEqual([105, 110])
    expect(r.points[0].week.getDay()).toBe(1)
  })

  it('a new exercise joins at 100 without hiding the others', () => {
    const r = overallProgress([
      session(W1, [['sentadilla-barra', 80, 10]]),
      session(W2, [
        ['sentadilla-barra', 96, 10],
        ['curl-mancuernas', 10, 10],
      ]),
    ])
    // Squat at 120, curl at 100.
    expect(r.points[1].index).toBe(110)
  })

  it('leaves out bodyweight work without load and unmarked sets', () => {
    const s = session(W1, [
      ['dominadas', 0, 8],
      ['sentadilla-barra', 80, 10],
    ])
    s.exercises[1].sets.push({ weight: 200, reps: 10, done: false })
    const r = overallProgress([s, session(W2, [['dominadas', 0, 10]])])
    expect(r.points.map((p) => p.exercises)).toEqual([1])
    expect(r.changes).toEqual([])
  })

  it('ignores sessions with a broken date', () => {
    const r = overallProgress([session('no es fecha', [['sentadilla-barra', 80, 10]])])
    expect(r.points).toEqual([])
  })

  it('counts exercises up, held and down, best first', () => {
    const r = overallProgress([
      session(W1, [
        ['sentadilla-barra', 80, 10],
        ['curl-mancuernas', 10, 10],
        ['banca-barra', 60, 10],
        ['remo-barra', 50, 10],
      ]),
      session(W2, [
        ['sentadilla-barra', 90, 10],
        ['curl-mancuernas', 10, 10],
        ['banca-barra', 50, 10],
      ]),
    ])
    expect(r.changes.map((c) => c.exerciseId)).toEqual(['sentadilla-barra', 'curl-mancuernas', 'banca-barra'])
    expect(r.changes[0].change).toBeCloseTo(0.125)
    expect(r.changes[0].sessions).toBe(2)
    expect([r.up, r.flat, r.down]).toEqual([1, 1, 1])
  })

  it('a change within 2% counts as held', () => {
    const r = overallProgress([session(W1, [['sentadilla-barra', 100, 10]]), session(W2, [['sentadilla-barra', 101.5, 10]])])
    expect([r.up, r.flat, r.down]).toEqual([0, 1, 0])
  })
})
