import { describe, expect, it } from 'vitest'
import { ALERT_WINDOW_MS, canMark, extendRest, restLabel, restLeft, shouldAlert, shouldAutoMark, startRest } from './rest'
import type { ActiveExercise, SetLog } from './types'

function exercise(sets: SetLog[]): ActiveExercise {
  return {
    exerciseId: 'press-mancuernas',
    plan: { exerciseId: 'press-mancuernas', slot: 'pressHorizontal', role: 'principal', sets: sets.length, repMin: 8, repMax: 12, rest: 180 },
    prescription: { mode: 'mantener', weight: 20, reps: sets.map(() => 10), delta: 0, note: '' },
    sets,
  }
}

const pending = (weight = 20, reps = 10): SetLog => ({ weight, reps, done: false })
const done = (weight = 20, reps = 10): SetLog => ({ weight, reps, done: true })

describe('rest timing', () => {
  it('always starts from the full length and keeps the end time', () => {
    const rest = startRest(180, 'x', 1_000)
    expect(rest).toEqual({ endsAt: 181_000, total: 180, label: 'x' })
    expect(restLeft(rest, 1_000)).toBe(180)
  })

  it('a new rest replaces the old one instead of continuing it', () => {
    const first = startRest(180, 'a', 0)
    const second = startRest(180, 'b', 100_000)
    expect(restLeft(second, 100_000)).toBe(180)
    expect(restLeft(first, 100_000)).toBe(80)
  })

  it('counts the time spent outside the app', () => {
    const rest = startRest(120, 'x', 0)
    expect(restLeft(rest, 90_000)).toBe(30)
    expect(restLeft(rest, 150_000)).toBe(-30)
  })

  it('adds 30 seconds to the end and to the total', () => {
    const rest = extendRest(startRest(90, 'x', 0), 30)
    expect(rest.endsAt).toBe(120_000)
    expect(rest.total).toBe(120)
  })
})

describe('shouldAlert', () => {
  const rest = startRest(60, 'x', 0)

  it('not while the rest is running', () => {
    expect(shouldAlert(rest, 30_000)).toBe(false)
  })

  it('right when it ends', () => {
    expect(shouldAlert(rest, 60_000)).toBe(true)
    expect(shouldAlert(rest, 60_000 + ALERT_WINDOW_MS)).toBe(true)
  })

  it('not when coming back to the app long after it ended', () => {
    expect(shouldAlert(rest, 60_000 + ALERT_WINDOW_MS + 1)).toBe(false)
    expect(shouldAlert(rest, 600_000)).toBe(false)
  })
})

describe('restLabel', () => {
  it('counts the sets left', () => {
    expect(restLabel(exercise([pending(), pending(), pending()]), 0, true)).toBe('Descanso, faltan 2 series')
    expect(restLabel(exercise([done(), pending(), pending()]), 1, true)).toBe('Descanso, falta 1 serie')
  })

  it('says when the exercise or the session is done', () => {
    expect(restLabel(exercise([done(), pending()]), 1, true)).toBe('Ejercicio listo')
    expect(restLabel(exercise([done(), pending()]), 1, false)).toBe('Última serie lista')
  })
})

describe('canMark', () => {
  it('needs reps, and weight unless bodyweight', () => {
    expect(canMark(20, 10, false)).toBe(true)
    expect(canMark(0, 10, false)).toBe(false)
    expect(canMark(0, 10, true)).toBe(true)
    expect(canMark(20, 0, false)).toBe(false)
  })
})

describe('shouldAutoMark', () => {
  it('marks the next set when its reps were typed', () => {
    expect(shouldAutoMark(exercise([done(), pending(), pending()]), 1, true, false)).toBe(true)
  })

  it('not when the reps were not changed', () => {
    expect(shouldAutoMark(exercise([pending(), pending()]), 0, false, false)).toBe(false)
  })

  it('not for a set further ahead, so sets can be filled in advance', () => {
    expect(shouldAutoMark(exercise([pending(), pending()]), 1, true, false)).toBe(false)
  })

  it('not for a set already marked', () => {
    expect(shouldAutoMark(exercise([done(), pending()]), 0, true, false)).toBe(false)
  })

  it('not without weight or reps', () => {
    expect(shouldAutoMark(exercise([pending(0, 10)]), 0, true, false)).toBe(false)
    expect(shouldAutoMark(exercise([pending(20, 0)]), 0, true, false)).toBe(false)
    expect(shouldAutoMark(exercise([pending(0, 10)]), 0, true, true)).toBe(true)
  })

  it('not for a set that does not exist', () => {
    expect(shouldAutoMark(exercise([pending()]), 3, true, false)).toBe(false)
  })
})
