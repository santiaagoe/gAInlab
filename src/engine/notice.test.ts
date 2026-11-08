import { describe, expect, it } from 'vitest'
import { effortText, FEEL_OPTIONS } from '../format'
import { getExercise } from './exercises'
import { coverageReport, planNotice } from './notice'
import { buildPlan, entryFor } from './plan'
import { removeExercise, replaceExercise } from './planEdit'
import { supersetStep, SUPERSET_SWITCH } from './rest'
import { profileOf } from './validation.harness'
import type { ActiveExercise, Plan } from './types'

describe('aviso de modo reducido', () => {
  it('2 días de 30 minutos: versión reducida, músculos listados y +15 min', () => {
    const p = profileOf({ days: 2, minutes: 30 })
    const n = planNotice(p, buildPlan(p))!
    expect(n.mode).toBe('reducido')
    expect(n.title).toBe('Versión reducida')
    expect(n.body).toBe(
      'Con 2 días de 30 minutos, 11 de 12 grupos musculares quedan bajo el volumen recomendado. Piernas, pecho y espalda mantienen un mínimo de trabajo.',
    )
    // At 2 days +15 min is still reduced; +1 day is not complete either, so no one-tap fix.
    expect(n.actions).toEqual([])
    expect(n.hint).toMatch(/más días o sesiones más largas/)
  })

  it('ofrece solo los cambios que llegan a un plan completo', () => {
    const p = profileOf({ days: 3, minutes: 45 })
    const n = planNotice(p, buildPlan(p))!
    expect(n.actions.map((a) => a.label)).toEqual(['Entrenar 4 días', 'Sesiones de 60 min'])
    expect(n.actions.map((a) => a.patch)).toEqual([{ days: 4 }, { minutes: 60 }])
  })

  it('nada en un plan completo, en planes antiguos ni en planes propios', () => {
    const p = profileOf({ days: 4, minutes: 60 })
    expect(planNotice(p, buildPlan(p))).toBeNull()
    const reduced = buildPlan(profileOf({ days: 2, minutes: 30 }))
    const { engine: _, ...old } = reduced
    expect(planNotice(profileOf({ days: 2, minutes: 30 }), old)).toBeNull()
    expect(planNotice(profileOf({ days: 2, minutes: 30 }), { ...reduced, custom: true })).toBeNull()
  })

  it('insuficiente: dice cuánto dura la sesión', () => {
    const p = profileOf({ days: 2, minutes: 30, age: '70+', experience: 'nuevo' })
    const n = planNotice(p, buildPlan(p))!
    expect(n.mode).toBe('insuficiente')
    expect(n.body).toMatch(/^Ni la versión mínima cabe en 30 minutos: cada sesión dura hasta \d+\.$/)
  })

  it('se basa en el plan como está: quitar el core de un plan completo hace aparecer el aviso', () => {
    const p = profileOf({ days: 4, minutes: 60 })
    let plan = buildPlan(p)
    for (const id of plan.days.map((d) => d.id)) {
      const core = () => plan.days.find((d) => d.id === id)!.exercises.findIndex((e) => e.slot === 'core')
      for (let i = core(); i >= 0; i = core()) plan = removeExercise(plan, id, i)
    }
    expect(planNotice(p, plan)?.body).toMatch(/core queda bajo el volumen recomendado/)
  })
})

describe('revisión de cobertura', () => {
  it('plan generado completo', () => {
    const p = profileOf({})
    expect(coverageReport(p, buildPlan(p))).toEqual({ ok: true, title: 'Tu plan cubre los 12 grupos musculares.', below: [], notes: [] })
  })

  it('plan armado a mano: músculos con sus series, patrones y frecuencia', () => {
    const p = profileOf({})
    const plan: Plan = {
      name: 'Mío',
      summary: '',
      custom: true,
      days: [
        { id: 'd1', name: 'Pecho', focus: '', exercises: [entryFor(p, getExercise('banca-barra')), entryFor(p, getExercise('remo-polea'))] },
        { id: 'd2', name: 'Pierna', focus: '', exercises: [entryFor(p, getExercise('prensa')), entryFor(p, getExercise('remo-polea'))] },
      ],
    }
    const r = coverageReport(p, plan)
    expect(r.ok).toBe(false)
    expect(r.title).toBe('Tu plan cubre 0 de 12 grupos musculares.')
    expect(r.below.find((l) => l.muscle === 'pecho')).toEqual({ muscle: 'pecho', name: 'pecho', sets: 3, minimum: 8 })
    expect(r.below.find((l) => l.muscle === 'biceps')).toMatchObject({ sets: 3 })
    expect(r.notes).toContain('Sin ejercicio de bisagra de cadera, empuje vertical y tirón vertical.')
    expect(r.notes.some((n) => n.startsWith('Solo una vez por semana: ') && n.includes('pecho'))).toBe(true)
  })
})

describe('superseries en la sesión', () => {
  const ex = (superset: string | undefined, done: boolean[], rest = 60): ActiveExercise =>
    ({
      plan: { exerciseId: 'x', slot: 'biceps', role: 'accesorio', sets: done.length, repMin: 10, repMax: 15, rest, superset },
      exerciseId: 'x',
      prescription: { mode: 'calibracion', weight: null, reps: [], delta: 0, note: '' },
      sets: done.map((d) => ({ weight: 10, reps: 10, done: d })),
    }) as ActiveExercise
  const name = (i: number) => `Ejercicio ${i}`

  it('alterna: después de una serie del primero, pasa al segundo; al cerrar la ronda, descanso', () => {
    const list = [ex(undefined, [true]), ex('A', [false, false, false]), ex('A', [false, false, false])]
    expect(supersetStep(list, 1, 0, name)).toEqual({ partner: 2, switchNow: true, rest: SUPERSET_SWITCH, label: 'Ahora: Ejercicio 2' })
    list[1].sets[0].done = true
    expect(supersetStep(list, 2, 0, name)).toEqual({ partner: 1, switchNow: false, rest: 60, label: 'Descanso entre rondas' })
  })

  it('sin pareja o con la pareja terminada, sigue el descanso normal', () => {
    expect(supersetStep([ex(undefined, [false])], 0, 0, name)).toBeNull()
    expect(supersetStep([ex('A', [false]), ex('B', [false])], 0, 0, name)).toBeNull()
    expect(supersetStep([ex('A', [true, false]), ex('A', [true, true])], 0, 1, name)).toBeNull()
  })

  it('cambiar o quitar un ejercicio deshace su superserie', () => {
    const p = profileOf({ days: 3, minutes: 45 })
    const plan = buildPlan(p)
    const day = plan.days.find((d) => d.exercises.some((e) => e.superset))!
    const i = day.exercises.findIndex((e) => e.superset)
    expect(day.exercises.filter((e) => e.superset === day.exercises[i].superset)).toHaveLength(2)
    for (const edited of [replaceExercise(plan, day.id, i, 'curl-martillo'), removeExercise(plan, day.id, i)]) {
      const after = edited.days.find((d) => d.id === day.id)!
      expect(after.exercises.filter((e) => e.superset === day.exercises[i].superset)).toHaveLength(0)
    }
  })
})

describe('texto de esfuerzo (tablas 3 y 10a)', () => {
  it('traduce el RIR objetivo al botón esperado', () => {
    expect(effortText(3)).toBe('Termina cada serie con unas 3 repeticiones de margen: «Justo».')
    expect(effortText(2)).toBe('Termina cada serie con unas 2 repeticiones de margen: «Justo».')
    expect(effortText(1)).toBe('Termina cada serie con una repetición de margen: «Al límite».')
    expect(effortText(0)).toBe('Puedes llevar la última serie al límite: «Al límite».')
    expect(FEEL_OPTIONS.map((o) => o.hint)).toEqual(['Sobraban 4+', 'Sobraban 2–3', 'Sobraban 0–1'])
  })
})
