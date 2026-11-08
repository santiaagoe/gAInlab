import { describe, expect, it } from 'vitest'
import { coverageOf, reviewPlan } from './coverage'
import { sessionMinutes } from './duration'
import { getExercise, isFreeBarbell, musclesOf } from './exercises'
import { generatePlan } from './generator'
import { buildPlan, entryFor } from './plan'
import { expectedFeel, rirFromFeel } from './rules'
import { contextFor } from './targets'
import { validatePlan } from './validate'
import { profileOf } from './validation.harness'
import type { Muscle, Plan } from './types'

const modeLetter = (m: string) => (m === 'completo' ? 'C' : m === 'reducido' ? 'R' : 'I')

describe('tabla 9c: hipertrofia, < 1 año, gimnasio', () => {
  // Rows: 2–6 days; columns: 30, 45, 60, 75, 90 minutes. The document marks 3×60 as "reducido (al límite)" and 4×45
  // as reduced without cuts; its note says that with the cuts of table 8a they may become complete, as they do here.
  // 5 and 6 days behave like 4 (strength-day cap of 4 for < 1 year).
  const expected: Record<number, string> = {
    2: 'RRRRR',
    3: 'RRCCC',
    4: 'RCCCC',
    5: 'RCCCC',
    6: 'RCCCC',
  }
  for (const days of [2, 3, 4, 5, 6]) {
    it(`${days} días`, () => {
      const row = [30, 45, 60, 75, 90].map((minutes) => modeLetter(generatePlan(profileOf({ days, minutes })).mode)).join('')
      expect(row).toBe(expected[days])
    })
  }
})

function weeklyOf(plan: Plan): Record<Muscle, number> {
  return coverageOf(plan.days).weekly
}

describe('lo que el generador anterior dejaba sin trabajo', () => {
  it('4 días de 60 minutos tienen trabajo directo de brazos', () => {
    const plan = buildPlan(profileOf({ days: 4, minutes: 60 }))
    const direct = plan.days.flatMap((d) => d.exercises).map((e) => getExercise(e.exerciseId))
    expect(direct.some((e) => e.muscles?.[0] === 'biceps' || e.muscles?.[0] === 'triceps')).toBe(true)
    expect(weeklyOf(plan).biceps).toBeGreaterThanOrEqual(8)
    expect(weeklyOf(plan).triceps).toBeGreaterThanOrEqual(8)
  })

  it('3 días de 60 minutos tienen gemelos, y todos los planes completos tienen core', () => {
    expect(weeklyOf(buildPlan(profileOf({ days: 3, minutes: 60 }))).gemelo).toBeGreaterThanOrEqual(8)
    for (const days of [3, 4, 5, 6]) {
      const r = generatePlan(profileOf({ days, minutes: 75 }))
      expect(r.mode).toBe('completo')
      expect(coverageOf(r.plan.days).weekly.core).toBeGreaterThanOrEqual(2)
      expect(coverageOf(r.plan.days).coreTypes.size).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('modo reducido y sugerencias', () => {
  it('lista los músculos bajo el mínimo y sugiere lo que sí llega a completo', () => {
    const r = generatePlan(profileOf({ days: 3, minutes: 45 }))
    expect(r.mode).toBe('reducido')
    expect(r.belowMin.length).toBeGreaterThan(0)
    expect(r.suggestion).toEqual({ addDay: true, addMinutes: true })
    expect(generatePlan(profileOf({ days: 4, minutes: 45 })).mode).toBe('completo')
    expect(generatePlan(profileOf({ days: 3, minutes: 60 })).mode).toBe('completo')
    expect(r.plan.engine).toEqual({ version: 2, mode: 'reducido' })
  })

  it('no sugiere un día más si el tope por experiencia no lo permite, ni pasar de 90 minutos', () => {
    const r = generatePlan(profileOf({ days: 4, minutes: 30 }))
    expect(r.suggestion?.addDay).toBe(false)
    expect(generatePlan(profileOf({ days: 2, minutes: 90 })).suggestion?.addMinutes).toBe(false)
  })

  it('un plan completo no trae sugerencia', () => {
    expect(generatePlan(profileOf({ days: 4, minutes: 60 })).suggestion).toBeNull()
  })

  it('modo insuficiente: el piso se genera igual y el resumen lo explica', () => {
    const r = generatePlan(profileOf({ days: 2, minutes: 30, age: '70+', experience: 'nuevo' }))
    expect(r.mode).toBe('insuficiente')
    expect(r.days.some((d) => d.minutes > 30)).toBe(true)
    expect(r.plan.engine).toEqual({ version: 2, mode: 'insuficiente' })
    expect(validatePlan(r)).toEqual([])
  })
})

describe('días de fuerza', () => {
  it('aplica el tope por experiencia y lo puede desactivar', () => {
    const capped = generatePlan(profileOf({ days: 6, experience: 'mas1', minutes: 75 }))
    expect(capped.plan.days).toHaveLength(5)
    expect(capped.restDays).toBe(1)
    expect(capped.plan.summary).toMatch(/descansar o hacer cardio/)
    const free = generatePlan(profileOf({ days: 6, experience: 'mas1', minutes: 75 }), { capStrengthDays: false })
    expect(free.plan.days).toHaveLength(6)
    expect(free.plan.name).toMatch(/Empuje, tirón y pierna/)
    expect(validatePlan(free)).toEqual([])
    expect(generatePlan(profileOf({ days: 6, experience: 'nuevo' }), { capStrengthDays: false }).plan.days).toHaveLength(6)
  })

  it('menores de 18: máximo 3 días, sin barra libre ni superseries, con la recomendación de supervisión', () => {
    const r = generatePlan(profileOf({ days: 5, age: 'menor', experience: 'mas1', minutes: 45 }))
    expect(r.plan.days).toHaveLength(3)
    const all = r.plan.days.flatMap((d) => d.exercises)
    expect(all.some((e) => isFreeBarbell(getExercise(e.exerciseId)))).toBe(false)
    expect(all.some((e) => e.superset)).toBe(false)
    expect(r.plan.summary).toMatch(/adulto o profesional/)
  })
})

describe('edad y experiencia', () => {
  it('mayores de 60 que empiezan: más repeticiones, RIR alto y consulta a un profesional', () => {
    const r = generatePlan(profileOf({ age: '70+', experience: 'nuevo', days: 3, minutes: 60 }))
    for (const e of r.plan.days.flatMap((d) => d.exercises)) {
      expect(e.repMin).toBeGreaterThanOrEqual(10)
      expect(e.rir).toBeGreaterThanOrEqual(3)
      expect(isFreeBarbell(getExercise(e.exerciseId))).toBe(false)
    }
    expect(r.plan.summary).toMatch(/profesional te acompañe/)
  })

  it('fuerza con más de un año: el básico con barra va primero en cada día', () => {
    const r = generatePlan(profileOf({ goal: 'fuerza', experience: 'mas1', days: 3, minutes: 90 }))
    for (const day of r.plan.days) {
      expect(day.exercises[0].role).toBe('principal')
      expect(getExercise(day.exercises[0].exerciseId).kind).toBe('barra')
      expect(day.exercises[0].sets).toBeLessThanOrEqual(4)
    }
  })

  it('50 a 59: la primera semana parte en el mínimo de 1a', () => {
    const ctx = contextFor(profileOf({ age: '50-59' }))
    expect(ctx.volume.pecho).toEqual({ min: 8, def: 8, max: 16 })
    const older = contextFor(profileOf({ age: '60-69' }))
    expect(older.volume.pecho).toEqual({ min: 8, def: 8, max: 10 })
    expect(older.maxSetsPerExercise).toBe(3)
  })
})

describe('equipo y molestias', () => {
  it('omite los patrones sin ejercicio seguro y lo dice en el resumen', () => {
    const r = generatePlan(profileOf({ equipment: 'casa', injuries: ['hombro'] }))
    expect(r.missingPatterns).toEqual(['empujeV', 'tironV'])
    expect(r.plan.summary).toMatch(/un profesional puede ayudarte/)
    expect(validatePlan(r)).toEqual([])
  })

  it('nunca elige un ejercicio marcado para la molestia', () => {
    const r = generatePlan(profileOf({ injuries: ['hombro', 'rodilla', 'espalda'], equipment: 'basico' }))
    for (const e of r.plan.days.flatMap((d) => d.exercises)) {
      expect(getExercise(e.exerciseId).avoid ?? []).toEqual([])
    }
  })
})

describe('determinismo (regla 17)', () => {
  it('la misma encuesta da exactamente el mismo resultado, sugerencia incluida', () => {
    const p = profileOf({ days: 3, minutes: 45, equipment: 'basico', injuries: ['rodilla'] })
    expect(JSON.stringify(generatePlan(p))).toBe(JSON.stringify(generatePlan(p)))
  })
})

describe('piezas sueltas', () => {
  it('fórmula 4b: el ejemplo de control del documento', () => {
    const minutes = sessionMinutes([{ sets: 4, reps: 10, rest: 120, approach: 0 }], 0)
    expect(minutes).toBeCloseTo(9.67, 1)
    expect(sessionMinutes([{ sets: 2, reps: 10, rest: 60, approach: 1, unilateral: true }], 5)).toBeCloseTo(5 + (2 * 80 + 60 + 60 + 60) / 60, 5)
    const pair = sessionMinutes(
      [
        { sets: 3, reps: 12, rest: 60, approach: 0, superset: 'A' },
        { sets: 3, reps: 12, rest: 60, approach: 0, superset: 'A' },
      ],
      0,
    )
    // Against the same two exercises done apart with the usual 90 s of table 4a: about 40 % less time.
    const apart = sessionMinutes([{ sets: 3, reps: 12, rest: 90, approach: 0 }], 0) * 2
    expect(pair / apart).toBeGreaterThan(0.5)
    expect(pair / apart).toBeLessThan(0.65)
  })

  it('tabla 10a: botones a RIR y botón esperado', () => {
    expect(rirFromFeel('justo', 10)).toBe(3)
    expect(rirFromFeel('justo', 15)).toBe(4)
    expect(rirFromFeel('limite', 8)).toBe(1)
    expect(rirFromFeel('facil', 8)).toBe(5)
    expect(expectedFeel(3)).toBe('justo')
    expect(expectedFeel(2)).toBe('justo')
    expect(expectedFeel(1)).toBe('limite')
    expect(expectedFeel(5)).toBe('facil')
  })

  it('ejercicio añadido a mano: dosis de las tablas 3 y 4a', () => {
    const p = profileOf({})
    expect(entryFor(p, getExercise('curl-martillo'))).toMatchObject({ role: 'accesorio', repMin: 10, repMax: 15, rest: 90, rir: 2, sets: 3 })
    expect(entryFor(p, getExercise('banca-mancuernas'))).toMatchObject({ role: 'secundario', repMin: 8, repMax: 12, rest: 120 })
  })

  it('conteo fraccional de la tabla 1b', () => {
    expect(musclesOf(getExercise('banca-barra'))).toEqual(['pecho', 'deltAnterior', 'triceps'])
    expect(musclesOf(getExercise('face-pull'))).toEqual(['deltPosterior'])
    const c = coverageOf([{ exercises: [{ exerciseId: 'remo-polea', sets: 4 }, { exerciseId: 'hip-thrust-mancuerna', sets: 2 }] }])
    expect(c.weekly).toMatchObject({ espalda: 4, biceps: 2, deltPosterior: 2, gluteo: 2, femoral: 0 })
  })
})

describe('revisión de cobertura de un plan existente', () => {
  it('detecta lo que falta en un plan armado a mano', () => {
    const p = profileOf({})
    const plan: Plan = {
      name: 'Mío',
      summary: '',
      days: [
        { id: 'd1', name: 'Pecho', focus: '', exercises: [entryFor(p, getExercise('banca-barra')), entryFor(p, getExercise('aperturas-maquina'))] },
        { id: 'd2', name: 'Pierna', focus: '', exercises: [entryFor(p, getExercise('sentadilla-barra'))] },
      ],
    }
    const review = reviewPlan(contextFor(p), plan)
    expect(review.mode).toBe('insuficiente')
    expect(review.belowMin).toContain('core')
    expect(review.belowMin).toContain('espalda')
    expect(review.missingPatterns).toEqual(['bisagra', 'empujeV', 'tironH', 'tironV'])
    expect(review.lowFrequency).toContain('pecho')
    const generated = reviewPlan(contextFor(p), buildPlan(p))
    expect(generated).toMatchObject({ mode: 'completo', belowMin: [], aboveMax: [], lowFrequency: [], missingPatterns: [] })
  })
})
