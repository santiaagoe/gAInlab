import { describe, expect, it } from 'vitest'
import { buildPlan } from './engine/plan'
import type { Profile } from './engine/types'
import { CURRENT_VERSION, migrate, parseState, StateError } from './persistence'

const profile: Profile = {
  goal: 'hipertrofia',
  age: '30-39',
  experience: 'menos1',
  situation: 'entreno',
  days: 3,
  minutes: 60,
  equipment: 'gimnasio',
  injuries: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

/** Data as v0.4 saves it. */
function saved() {
  return {
    version: 1,
    profile,
    plan: buildPlan(profile),
    sessions: [
      {
        id: 's1',
        date: '2026-01-02T18:00:00.000Z',
        dayId: 'd1',
        dayName: 'Full body A',
        exercises: [{ exerciseId: 'banca-barra', repMin: 8, repMax: 12, feel: 'justo', sets: [{ weight: 50, reps: 10, done: true }] }],
      },
    ],
    settings: { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'lista' },
    notes: { 'banca-barra': 'agarre medio' },
    customExercises: [{ id: 'custom-a', name: 'Press Hammer', kind: 'maquina', muscle: 'pecho', compound: true }],
  }
}

describe('parseState', () => {
  it('reads v0.4 data without changing it', () => {
    const data = saved()
    const r = parseState(JSON.parse(JSON.stringify(data)))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dropped).toBe(0)
    expect(r.unknownExercises).toEqual([])
    expect(r.state).toEqual({ ...data, version: CURRENT_VERSION })
  })

  it('rejects things that are not gAInlab data', () => {
    expect(parseState(null).ok).toBe(false)
    expect(parseState([]).ok).toBe(false)
    expect(parseState({ version: 1 }).ok).toBe(false)
    expect(parseState('hola').ok).toBe(false)
  })

  it('drops and counts a plan without days instead of crashing later', () => {
    const r = parseState({ ...saved(), plan: { name: 'x', summary: '', days: [] } })
    expect(r.ok && r.state.plan).toBeUndefined()
    expect(r.ok && r.dropped).toBe(1)
  })

  it('drops broken sets, logs and sessions and counts them', () => {
    const data = saved()
    data.sessions.push({ id: 's2', date: 'no es fecha', dayId: 'd1', dayName: 'x', exercises: [] })
    data.sessions[0].exercises[0].sets.push({ weight: 'mucho', reps: 3, done: true } as never)
    const r = parseState(data)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.sessions).toHaveLength(1)
    expect(r.state.sessions[0].exercises[0].sets).toHaveLength(1)
    expect(r.dropped).toBe(2)
  })

  it('reports plan exercises that are not in the library nor in the custom list', () => {
    const data = saved()
    data.plan.days[0].exercises[0].exerciseId = 'ejercicio-inventado'
    data.plan.days[1].exercises[0].exerciseId = 'custom-a'
    const r = parseState(data)
    expect(r.ok && r.unknownExercises).toEqual(['ejercicio-inventado'])
  })

  it('cleans notes, settings and custom exercises', () => {
    const r = parseState({
      ...saved(),
      settings: { incBarra: -1, incMancuerna: 'x', sessionView: 'raro' },
      notes: { a: 'ok', b: 3, c: '  ' },
      customExercises: [null, { id: 'banca-barra', name: 'copia', kind: 'barra', muscle: 'pecho', compound: true }],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.settings).toEqual({ incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'enfoque' })
    expect(r.state.notes).toEqual({ a: 'ok' })
    expect(r.state.customExercises).toEqual([])
    expect(r.dropped).toBe(2)
  })

  it('keeps a valid session in progress and drops a broken one', () => {
    const activeOk = {
      id: 'x',
      startedAt: '2026-01-03T10:00:00Z',
      dayId: 'd1',
      dayName: 'Full body A',
      current: 9,
      exercises: [
        {
          plan: { exerciseId: 'banca-barra', slot: 'pressHorizontal', role: 'principal', sets: 3, repMin: 8, repMax: 12, rest: 150 },
          exerciseId: 'banca-barra',
          prescription: { mode: 'calibracion', weight: null, reps: [12, 12, 12], delta: 0, note: 'Primera vez' },
          sets: [{ weight: 0, reps: 0, done: false }],
        },
      ],
    }
    const ok = parseState({ ...saved(), active: activeOk })
    expect(ok.ok && ok.state.active?.current).toBe(0)
    const broken = parseState({ ...saved(), active: { ...activeOk, exercises: [{ plan: {} }] } })
    expect(broken.ok && broken.state.active).toBeUndefined()
    expect(broken.ok && broken.dropped).toBe(1)
  })

  it('keeps old logs that have no rep range', () => {
    const data = saved()
    const log = data.sessions[0].exercises[0] as Record<string, unknown>
    delete log.repMin
    delete log.repMax
    const r = parseState(data)
    expect(r.ok && r.dropped).toBe(0)
    expect(r.ok && r.state.sessions[0].exercises[0]).not.toHaveProperty('repMin')
  })
})

describe('migrate', () => {
  it('treats data without a version as version 1', () => {
    expect(migrate({ sessions: [] }).version).toBe(CURRENT_VERSION)
  })

  it('refuses data from a newer version', () => {
    expect(() => migrate({ version: CURRENT_VERSION + 1 })).toThrow(StateError)
    const r = parseState({ ...saved(), version: CURRENT_VERSION + 1 })
    expect(r.ok).toBe(false)
  })

  it('runs every step in order up to the target', () => {
    const steps = {
      1: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
      2: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
    }
    expect(migrate({ version: 1 }, steps, 3)).toEqual({ version: 3, a: 1, b: 2 })
    expect(() => migrate({ version: 1 }, { 1: steps[1] }, 3)).toThrow(/versión 2/)
  })
})
