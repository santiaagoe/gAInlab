import { describe, expect, it } from 'vitest'
import type { Session } from './engine/types'
import { chipText, clock, kg, relativeDay, setsText, weekStart, weekStreak } from './format'

function on(date: Date): Session {
  return { id: date.toISOString(), date: date.toISOString(), dayId: 'd1', dayName: 'Día 1', exercises: [] }
}

/** `n` sessions on consecutive days starting on the Tuesday of the week `weeksAgo` before `now`. */
function week(now: Date, weeksAgo: number, n: number): Session[] {
  const start = weekStart(now)
  start.setDate(start.getDate() - weeksAgo * 7 + 1)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    d.setHours(18)
    return on(d)
  })
}

describe('weekStreak', () => {
  // Thursday.
  const now = new Date(2026, 10, 12, 12)

  it('counts beyond the 8 weeks of the chart', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => week(now, i + 1, 3)).flat()
    expect(weekStreak(sessions, 3, now)).toBe(20)
  })

  it('adds the current week only once it is met, without breaking the streak before', () => {
    const past = [...week(now, 1, 3), ...week(now, 2, 3)]
    expect(weekStreak([...past, ...week(now, 0, 1)], 3, now)).toBe(2)
    expect(weekStreak([...past, ...week(now, 0, 3)], 3, now)).toBe(3)
  })

  it('stops at the first week that was not met', () => {
    const sessions = [...week(now, 1, 3), ...week(now, 2, 2), ...week(now, 3, 3)]
    expect(weekStreak(sessions, 3, now)).toBe(1)
  })

  it('works across the new year', () => {
    const jan = new Date(2027, 0, 6, 12)
    const sessions = [...week(jan, 1, 2), ...week(jan, 2, 2), ...week(jan, 3, 2)]
    expect(weekStreak(sessions, 2, jan)).toBe(3)
  })

  it('is zero without sessions', () => {
    expect(weekStreak([], 3, now)).toBe(0)
  })
})

describe('weekStart', () => {
  it('starts weeks on Monday, also from a Sunday', () => {
    expect(weekStart(new Date(2026, 10, 15, 23)).getDate()).toBe(9)
    expect(weekStart(new Date(2026, 10, 9, 0, 5)).getDate()).toBe(9)
  })
})

describe('relativeDay', () => {
  const now = new Date(2026, 10, 12, 9)
  it('describes recent days', () => {
    expect(relativeDay(new Date(2026, 10, 12, 7).toISOString(), now)).toBe('Hoy')
    expect(relativeDay(new Date(2026, 10, 11, 23).toISOString(), now)).toBe('Ayer')
    expect(relativeDay(new Date(2026, 10, 9, 10).toISOString(), now)).toBe('Hace 3 días')
  })

  it('shows a date for future and old days', () => {
    expect(relativeDay(new Date(2026, 10, 13, 10).toISOString(), now)).not.toMatch(/Hace|-/)
    expect(relativeDay(new Date(2026, 9, 1, 10).toISOString(), now)).not.toMatch(/Hace/)
  })
})

describe('small formats', () => {
  it('formats weights, times and sets', () => {
    expect(kg(52.5)).toBe('52,5')
    expect(clock(65)).toBe('1:05')
    expect(clock(180)).toBe('3:00')
    expect(chipText('subir', 2.5)).toBe('+2,5 kg')
    expect(chipText('bajar', -5)).toBe('−5 kg')
    expect(
      setsText({
        exerciseId: 'x',
        repMin: 8,
        repMax: 12,
        sets: [
          { weight: 50, reps: 10, done: true },
          { weight: 50, reps: 9, done: true },
        ],
      }),
    ).toBe('50 kg × 10, 9')
  })
})
