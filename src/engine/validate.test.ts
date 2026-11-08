import { describe, expect, it } from 'vitest'
import { generatePlan, type GeneratedPlan } from './generator'
import { patternUnavailable, validatePlan } from './validate'
import { profileOf } from './validation.harness'
import { getExercise } from './exercises'
import { contextFor } from './targets'
import type { PlanExercise, Profile } from './types'

/** The validator must catch each kind of broken plan: these tests break a valid plan on purpose. */
function base(p: Partial<Profile> = {}): GeneratedPlan {
  return structuredClone(generatePlan(profileOf({ days: 4, minutes: 60, ...p })))
}

function rulesOf(r: GeneratedPlan): number[] {
  return [...new Set(validatePlan(r).map((v) => v.rule))].sort((a, b) => a - b)
}

function all(r: GeneratedPlan): PlanExercise[] {
  return r.plan.days.flatMap((d) => d.exercises)
}

function dropWhere(r: GeneratedPlan, test: (e: PlanExercise) => boolean) {
  r.plan.days.forEach((d) => (d.exercises = d.exercises.filter((e) => !test(e))))
}

const isMuscle = (m: string) => (e: PlanExercise) => getExercise(e.exerciseId).muscles?.[0] === m

describe('validatePlan', () => {
  it('acepta el plan generado', () => {
    expect(validatePlan(base())).toEqual([])
  })

  it('regla 1 y 2: volumen fuera de rango y aviso incorrecto', () => {
    const r = base()
    dropWhere(r, (e) => e.slot === 'core')
    expect(rulesOf(r)).toEqual(expect.arrayContaining([1, 2]))
    const wrongWarning = base()
    wrongWarning.belowMin = ['pecho']
    expect(rulesOf(wrongWarning)).toContain(1)
    const tooMuch = base()
    all(tooMuch).filter((e) => e.slot === 'pressHorizontal').forEach((e) => (e.sets = 12))
    expect(rulesOf(tooMuch)).toEqual(expect.arrayContaining([1, 4, 5]))
  })

  it('regla 3: un músculo entrenado una sola vez por semana', () => {
    const r = base()
    let seen = false
    r.plan.days.forEach((d) => {
      if (d.exercises.some(isMuscle('gemelo'))) {
        if (seen) d.exercises = d.exercises.filter((e) => !isMuscle('gemelo')(e))
        seen = true
      }
    })
    expect(rulesOf(r)).toContain(3)
  })

  it('reglas 5 a 8: series, repeticiones, RIR y descanso', () => {
    const r = base()
    const [first, second, third, fourth] = all(r)
    first.sets = 1
    second.repMin = 1
    third.rir = 0
    fourth.rest = 10
    expect(rulesOf(r)).toEqual(expect.arrayContaining([5, 6, 7, 8]))
    const noRir = base()
    delete all(noRir)[0].rir
    expect(rulesOf(noRir)).toContain(7)
  })

  it('regla 9: duración por encima del tiempo o muy corta tras recortes', () => {
    const r = base()
    r.days[0].minutes = 75
    expect(rulesOf(r)).toContain(9)
    const short = base()
    short.days[0] = { ...short.days[0], trimmed: true, minutes: 20 }
    expect(rulesOf(short)).toContain(9)
  })

  it('regla 10: más días de los elegidos o del tope', () => {
    const r = base()
    r.plan.days.push(structuredClone(r.plan.days[0]))
    expect(rulesOf(r)).toContain(10)
  })

  it('regla 11: dos sesiones pesadas del mismo músculo en días seguidos', () => {
    const r = base()
    const [torsoA, piernaA, torsoB, piernaB] = r.plan.days
    r.plan.days = [torsoA, torsoB, piernaA, piernaB]
    expect(rulesOf(r)).toContain(11)
  })

  it('regla 12: aislamiento antes de un compuesto, o algo después del core', () => {
    const r = base()
    const day = r.plan.days[0]
    day.exercises = [...day.exercises.slice(-1), ...day.exercises.slice(0, -1)]
    expect(rulesOf(r)).toContain(12)
    const leg = base()
    const legDay = leg.plan.days[1]
    const curl = legDay.exercises.findIndex(isMuscle('femoral'))
    expect(curl).toBeGreaterThan(-1)
    legDay.exercises.push(legDay.exercises.splice(curl, 1)[0])
    expect(rulesOf(leg)).toContain(12)
  })

  it('regla 13: falta un patrón que sí estaba disponible, o un ejercicio no corresponde', () => {
    const r = base()
    dropWhere(r, (e) => e.slot === 'jalon')
    expect(rulesOf(r)).toContain(13)
    expect(patternUnavailable(r.context, 'tironV')).toBe(false)
    const home = base({ equipment: 'casa', injuries: ['hombro'] })
    expect(patternUnavailable(home.context, 'tironV')).toBe(true)
    all(home)[0].exerciseId = 'prensa'
    expect(rulesOf(home)).toContain(13)
  })

  it('regla 14: proporciones fuera de rango', () => {
    const r = base()
    dropWhere(r, isMuscle('deltPosterior'))
    expect(rulesOf(r)).toContain(14)
    const legs = base()
    dropWhere(legs, isMuscle('femoral'))
    all(legs).filter((e) => e.slot === 'bisagra').forEach((e) => (e.sets = 2))
    expect(rulesOf(legs)).toContain(14)
  })

  it('regla 15: barra libre o demasiados ejercicios para alguien nuevo', () => {
    const r = base({ experience: 'nuevo', days: 3 })
    expect(validatePlan(r)).toEqual([])
    all(r).find((e) => e.slot === 'pressHorizontal')!.exerciseId = 'banca-barra'
    r.plan.days[0].exercises.push(...structuredClone(r.plan.days[1].exercises))
    expect(rulesOf(r)).toEqual(expect.arrayContaining([15]))
  })

  it('regla 16: superseries no seguras', () => {
    const r = base({ minutes: 45 })
    const day = r.plan.days[0]
    day.exercises[0].superset = 'Z'
    day.exercises[1].superset = 'Z'
    expect(rulesOf(r)).toContain(16)
    const lonely = base({ minutes: 45 })
    lonely.plan.days[0].exercises.at(-1)!.superset = 'Q'
    expect(rulesOf(lonely)).toContain(16)
    const teen = base({ age: 'menor', days: 3 })
    const iso = teen.plan.days[0].exercises.filter((e) => e.role === 'accesorio')
    iso.slice(0, 2).forEach((e) => (e.superset = 'A'))
    expect(rulesOf(teen)).toContain(16)
    const older = base({ age: '60-69', experience: 'mas1' })
    const isoOld = older.plan.days[0].exercises.filter((e) => e.role === 'accesorio')
    isoOld.slice(0, 2).forEach((e) => (e.superset = 'A'))
    expect(contextFor(older.context.profile).supersets).toBe('maquina')
    expect(rulesOf(older)).toContain(16)
  })
})
