import { describe, expect, it } from 'vitest'
import { buildPlan } from './plan'
import { checkRemoval, checkSwap } from './swap'
import type { Plan, Profile } from './types'

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
const plan = buildPlan(profile)
// Full body A: sentadilla-barra, banca-barra, remo-barra, elevaciones-laterales, curl-mancuernas

describe('checkSwap', () => {
  it('accepts an equivalent movement without warnings', () => {
    const r = checkSwap(plan, 'd1', 1, 'press-pecho-maquina', [])
    expect(r.level).toBe('igual')
    expect(r.warnings).toHaveLength(0)
  })

  it('flags a similar zone with a different pattern', () => {
    const r = checkSwap(plan, 'd1', 1, 'aperturas-maquina', [])
    expect(r.level).toBe('parecido')
    expect(r.warnings.join(' ')).toMatch(/aislamiento/)
  })

  it('warns when the zone is different', () => {
    const r = checkSwap(plan, 'd1', 0, 'curl-barra', [])
    expect(r.level).toBe('distinto')
    expect(r.title).toMatch(/No trabaja la misma zona/)
  })

  it('warns when a muscle loses all weekly work', () => {
    const small: Plan = {
      name: 'Prueba',
      summary: '',
      days: [
        {
          id: 'd1',
          name: 'Día 1',
          focus: '',
          exercises: [
            { exerciseId: 'banca-barra', slot: 'pressHorizontal', role: 'principal', sets: 3, repMin: 8, repMax: 12, rest: 120 },
            { exerciseId: 'gemelo-maquina', slot: 'gemelo', role: 'accesorio', sets: 3, repMin: 10, repMax: 15, rest: 60 },
          ],
        },
      ],
    }
    const r = checkSwap(small, 'd1', 1, 'curl-barra', [])
    expect(r.warnings.some((w) => w.includes('gemelos') && w.includes('toda la semana'))).toBe(true)
    const same = checkSwap(small, 'd1', 1, 'gemelo-mancuerna', [])
    expect(same.warnings).toHaveLength(0)
  })

  it('blocks duplicates in the same day', () => {
    const r = checkSwap(plan, 'd1', 0, 'banca-barra', [])
    expect(r.level).toBe('bloqueado')
  })

  it('warns about injuries', () => {
    const r = checkSwap(plan, 'd1', 1, 'aperturas-mancuernas', ['hombro'])
    expect(r.warnings.some((w) => w.includes('hombro'))).toBe(true)
  })
})

describe('checkRemoval', () => {
  it('warns only when a muscle loses all weekly work', () => {
    const p = buildPlan({ ...profile, days: 4 })
    const torsoA = p.days[0]
    const lateral = torsoA.exercises.findIndex((e) => e.slot === 'lateral')
    expect(lateral).toBeGreaterThanOrEqual(0)
    // Shoulders are still trained by the overhead press, so no warning.
    expect(checkRemoval(p, torsoA.id, lateral)).toHaveLength(0)
  })
})
