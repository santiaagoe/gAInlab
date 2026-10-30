import { describe, expect, it } from 'vitest'
import { buildPlan } from './plan'
import { prescribe, type HistoryEntry } from './progression'
import { prescriptionFor } from './session'
import type { AgeGroup, ExerciseLog, Feel, PlanExercise, Profile, Session, Settings } from './types'

const settings: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'enfoque' }
const DAY = 86_400_000
const now = new Date('2026-11-10T12:00:00Z')

function planOf(exerciseId: string, sets: number, repMin: number, repMax: number): PlanExercise {
  return { exerciseId, slot: 'pressHorizontal', role: 'principal', sets, repMin, repMax, rest: 120 }
}

function log(plan: PlanExercise, weight: number | number[], reps: number[], feel?: Feel, extra: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    exerciseId: plan.exerciseId,
    repMin: plan.repMin,
    repMax: plan.repMax,
    feel,
    sets: reps.map((r, i) => ({ weight: Array.isArray(weight) ? weight[i] : weight, reps: r, done: true })),
    ...extra,
  }
}

function at(daysAgo: number, l: ExerciseLog): HistoryEntry {
  return { date: new Date(now.getTime() - daysAgo * DAY).toISOString(), log: l }
}

const bench = planOf('banca-barra', 3, 8, 12)

describe('A1: an exercise done on two days with different doses', () => {
  const heavy = planOf('banca-barra', 4, 4, 6)
  const light = planOf('banca-barra', 3, 6, 8)

  it('goes up on the 3-set day after topping the 4-set day', () => {
    const p = prescribe(light, [at(2, log(heavy, 40, [6, 6, 6, 6], 'justo'))], settings, now)
    expect(p.mode).toBe('subir')
    expect(p.weight).toBe(42.5)
    expect(p.reps).toEqual([6, 6, 6])
  })

  it('goes up on the 4-set day after topping the 3-set day', () => {
    const p = prescribe(heavy, [at(2, log(light, 40, [8, 8, 8], 'justo'))], settings, now)
    expect(p.mode).toBe('subir')
    expect(p.weight).toBe(42.5)
    expect(p.reps).toEqual([4, 4, 4, 4])
  })

  it('does not call reps that were inside the other range "below range"', () => {
    const p = prescribe(light, [at(2, log(heavy, 40, [5, 5, 5, 5], 'justo'))], settings, now)
    expect(p.mode).toBe('mantener')
    expect(p.weight).toBe(40)
    expect(p.reps).toEqual([6, 6, 6])
  })

  it('keeps raising the weight across weeks in the 4-day strength plan', () => {
    const profile: Profile = {
      goal: 'fuerza',
      experience: 'menos1',
      situation: 'entreno',
      days: 4,
      minutes: 75,
      equipment: 'gimnasio',
      injuries: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    const plan = buildPlan(profile)
    // Find an exercise that the generator put on two days with different rep ranges.
    const entries = plan.days.flatMap((d) => d.exercises)
    const repeated = entries.find((e) => entries.some((o) => o !== e && o.exerciseId === e.exerciseId && o.repMax !== e.repMax))
    expect(repeated).toBeDefined()
    const id = repeated!.exerciseId

    const sessions: Session[] = []
    const weights: number[] = []
    let date = new Date('2026-01-05T18:00:00Z')
    for (let week = 0; week < 8; week++) {
      for (const day of plan.days) {
        const exercises: ExerciseLog[] = []
        for (const pe of day.exercises) {
          const rx = prescriptionFor({ sessions, settings }, pe, date)
          // A consistent user: calibrates at 40 kg inside the range, then does exactly what is prescribed.
          const weight = rx.weight ?? 40
          const reps = rx.mode === 'calibracion' ? Array(pe.sets).fill(pe.repMin + 1) : rx.reps
          exercises.push(log(pe, weight, reps, 'justo'))
          if (pe.exerciseId === id) weights.push(weight)
        }
        sessions.push({ id: `${week}-${day.id}`, date: date.toISOString(), dayId: day.id, dayName: day.name, exercises })
        date = new Date(date.getTime() + 2 * DAY)
      }
    }
    // Before the fix the weight never moved from 40 kg.
    expect(weights.at(-1)!).toBeGreaterThanOrEqual(weights[0] + 5)
    // It never goes down for someone doing everything right.
    weights.forEach((w, i) => i > 0 && expect(w).toBeGreaterThanOrEqual(weights[i - 1]))
  })
})

describe('A2: return mode measures time without training at all', () => {
  it('does not trigger when the exercise is rotated but the user keeps training', () => {
    const history = [at(14, log(bench, 90, [10, 10, 10], 'justo'))]
    const lastTrained = new Date(now.getTime() - 3 * DAY).toISOString()
    const p = prescribe(bench, history, settings, now, undefined, lastTrained)
    expect(p.mode).toBe('mantener')
    expect(p.weight).toBe(90)
  })

  it('triggers after a real break', () => {
    const history = [at(20, log(bench, 90, [10, 10, 10], 'justo'))]
    const p = prescribe(bench, history, settings, now, undefined, history[0].date)
    expect(p.mode).toBe('regreso')
    expect(p.weight).toBe(80)
  })

  it('never lowers the weight in a plan trained fewer days than planned', () => {
    const profile: Profile = {
      goal: 'hipertrofia',
      experience: 'menos1',
      situation: 'entreno',
      days: 4,
      minutes: 60,
      equipment: 'gimnasio',
      injuries: [],
      createdAt: '2026-01-01T00:00:00Z',
    }
    const plan = buildPlan(profile)
    const sessions: Session[] = []
    let date = new Date('2026-01-05T18:00:00Z')
    for (let i = 0; i < 16; i++) {
      // Two sessions a week: each plan day comes back every 14 days.
      const day = plan.days[i % plan.days.length]
      const exercises = day.exercises.map((pe) => {
        const rx = prescriptionFor({ sessions, settings, age: '60-69' as AgeGroup }, pe, date)
        expect(rx.mode).not.toBe('regreso')
        expect(rx.delta).toBeGreaterThanOrEqual(0)
        return log(pe, rx.weight ?? 50, rx.mode === 'calibracion' ? Array(pe.sets).fill(pe.repMin) : rx.reps, 'justo')
      })
      sessions.push({ id: String(i), date: date.toISOString(), dayId: day.id, dayName: day.name, exercises })
      date = new Date(date.getTime() + (i % 2 === 0 ? 3 : 4) * DAY)
    }
  })

  it('counts calendar days, so the hour of the day does not matter', () => {
    const late = new Date(2026, 9, 27, 22, 30)
    const early = new Date(2026, 10, 10, 8, 0)
    const history = [{ date: late.toISOString(), log: log(bench, 60, [10, 10, 10]) }]
    expect(prescribe(bench, history, settings, early).mode).toBe('regreso')
  })

  it('talks in days below two weeks and in weeks after that', () => {
    const history = [at(11, log(bench, 60, [10, 10, 10]))]
    expect(prescribe(bench, history, settings, now, '60-69').note).toMatch(/^Llevas 11 días/)
    const longer = [at(21, log(bench, 60, [10, 10, 10]))]
    expect(prescribe(bench, longer, settings, now).note).toMatch(/^Llevas 3 semanas/)
  })

  it('uses 10% after two weeks, 20% after four and 30% after eight, plus the age extra', () => {
    const w = (days: number, age?: AgeGroup) => prescribe(bench, [at(days, log(bench, 100, [10, 10, 10]))], settings, now, age).weight
    expect(w(15)).toBe(90)
    expect(w(30)).toBe(80)
    expect(w(60)).toBe(70)
    expect(w(30, '70+')).toBe(70)
  })
})

describe('M4: climbing back after a break', () => {
  it('raises the weight every completed session until the old weight', () => {
    const first = prescribe(bench, [at(35, log(bench, 60, [10, 10, 10]))], settings, now)
    expect(first).toMatchObject({ mode: 'regreso', weight: 47.5, recoverTo: 60 })

    const climbed: number[] = []
    let weight = first.weight!
    let recoverTo = first.recoverTo
    const history: HistoryEntry[] = []
    for (let i = 0; i < 6 && recoverTo; i++) {
      history.push(at(10 - i, log(bench, weight, [8, 8, 8], 'justo', { recoverTo })))
      const p = prescribe(bench, history, settings, now, undefined, history.at(-1)!.date)
      expect(p.mode).toBe('subir')
      climbed.push(p.weight!)
      weight = p.weight!
      recoverTo = p.recoverTo
    }
    expect(climbed).toEqual([52.5, 55, 57.5, 60])
    expect(recoverTo).toBeUndefined()
  })

  it('holds the weight when the session was at the limit, without losing the goal', () => {
    const p = prescribe(bench, [at(2, log(bench, 50, [8, 8, 8], 'limite', { recoverTo: 60 }))], settings, now)
    expect(p).toMatchObject({ mode: 'mantener', weight: 50, recoverTo: 60 })
  })

  it('aims for the original weight if there is a second break during the climb', () => {
    const p = prescribe(bench, [at(30, log(bench, 50, [8, 8, 8], 'justo', { recoverTo: 60 }))], settings, now)
    expect(p.mode).toBe('regreso')
    expect(p.recoverTo).toBe(60)
  })
})

describe('M1: the strength-estimate correction only after calibrating', () => {
  it('a bad normal session repeats the weight instead of a big cut', () => {
    const history = [at(9, log(bench, 100, [10, 10, 10], 'justo')), at(2, log(bench, 100, [5, 5, 5], 'limite'))]
    const p = prescribe(bench, history, settings, now)
    expect(p.mode).toBe('repetir')
    expect(p.weight).toBe(100)
  })

  it('a very light normal session raises one step', () => {
    const history = [at(9, log(bench, 50, [10, 10, 10], 'justo')), at(2, log(bench, 50, [16, 16, 16], 'facil'))]
    const p = prescribe(bench, history, settings, now)
    expect(p).toMatchObject({ mode: 'subir', weight: 55 })
  })

  it('a calibration far below the range corrects down', () => {
    const p = prescribe(bench, [at(2, log(bench, 80, [4, 4, 3], 'limite'))], settings, now)
    expect(p.mode).toBe('ajuste')
    expect(p.weight).toBe(67.5)
    expect(p.reps).toEqual([9, 9, 9])
  })
})

describe('M2: weight raised between sets', () => {
  it('a ramp in calibration is not "below range"', () => {
    const p = prescribe(bench, [at(2, log(bench, [60, 70, 80], [12, 12, 12], 'justo'))], settings, now)
    expect(p.mode).toBe('mantener')
    expect(p.weight).toBe(80)
    expect(p.reps).toEqual([12, 12, 12])
    expect(p.note).toMatch(/haz las 3 series con 80/)
  })

  it('still repeats when most sets at the working weight fell short', () => {
    const history = [at(9, log(bench, 80, [8, 8, 8])), at(2, log(bench, [60, 80, 80], [12, 6, 5]))]
    const p = prescribe(bench, history, settings, now)
    expect(p).toMatchObject({ mode: 'repetir', weight: 80 })
  })
})

describe('B1: a cut never raises a very light weight', () => {
  const raises = planOf('elevaciones-laterales', 3, 10, 15)
  it('deload keeps 1 kg when the dumbbell step is 2 kg', () => {
    const history = [at(9, log(raises, 1, [6, 6, 6])), at(2, log(raises, 1, [6, 6, 6]))]
    const p = prescribe(raises, history, settings, now)
    expect(p).toMatchObject({ mode: 'bajar', weight: 1, delta: 0 })
  })

  it('return mode keeps 1 kg too', () => {
    const p = prescribe(raises, [at(40, log(raises, 1, [12, 12, 12]))], settings, now)
    expect(p).toMatchObject({ mode: 'regreso', weight: 1 })
  })
})

describe('other branches', () => {
  const pullups = planOf('dominadas', 3, 6, 10)

  it('bodyweight adds a rep per set', () => {
    const p = prescribe(pullups, [at(2, log(pullups, 0, [7, 6, 5], 'justo'))], settings, now)
    expect(p).toMatchObject({ mode: 'mantener', weight: 0, reps: [8, 7, 6] })
  })

  it('bodyweight at the top suggests extra load', () => {
    const p = prescribe(pullups, [at(2, log(pullups, 0, [10, 10, 10], 'justo'))], settings, now)
    expect(p.reps).toEqual([10, 10, 10])
    expect(p.note).toMatch(/lastre/)
  })

  it('bodyweight never goes into return mode', () => {
    const p = prescribe(pullups, [at(60, log(pullups, 0, [8, 8, 8]))], settings, now)
    expect(p.mode).toBe('mantener')
  })

  it('uses the dumbbell and machine increments', () => {
    const curl = planOf('curl-mancuernas', 3, 10, 15)
    expect(prescribe(curl, [at(2, log(curl, 12, [15, 15, 15], 'facil'))], settings, now).weight).toBe(14)
    const press = planOf('press-pecho-maquina', 3, 8, 12)
    expect(prescribe(press, [at(2, log(press, 50, [12, 12, 12], 'justo'))], { ...settings, incMaquina: 5 }, now).weight).toBe(55)
  })

  it('older lifters hold once at the limit, then go up', () => {
    const top = log(bench, 50, [12, 12, 12], 'limite')
    expect(prescribe(bench, [at(2, top)], settings, now, '60-69')).toMatchObject({ mode: 'mantener', weight: 50 })
    expect(prescribe(bench, [at(5, top), at(2, top)], settings, now, '60-69')).toMatchObject({ mode: 'subir', weight: 52.5 })
  })

  it('logs without a saved range fall back to the plan', () => {
    const old = { ...log(bench, 50, [12, 12, 12], 'justo') } as Partial<ExerciseLog>
    delete old.repMin
    delete old.repMax
    const p = prescribe(bench, [{ date: new Date(now.getTime() - 2 * DAY).toISOString(), log: old as ExerciseLog }], settings, now)
    expect(p).toMatchObject({ mode: 'subir', weight: 52.5 })
  })
})
