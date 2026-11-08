import { expect, it } from 'vitest'
import { generatePlan } from './generator'
import { validatePlan } from './validate'
import type { AgeGroup, Equipment, Experience, Goal, Injury, Profile } from './types'

/**
 * Runs the 17 validation rules of docs/reglas-entrenamiento.md over every survey combination for one age group:
 * 4 goals × 3 experience levels × 5 day counts × 5 session lengths × 3 equipment options × 8 injury sets.
 * One file per age group so Vitest can run them in parallel.
 */
export const GOALS: Goal[] = ['hipertrofia', 'grasa', 'fuerza', 'salud']
export const EXPERIENCES: Experience[] = ['nuevo', 'menos1', 'mas1']
export const DAYS = [2, 3, 4, 5, 6]
export const MINUTES = [30, 45, 60, 75, 90]
export const EQUIPMENT: Equipment[] = ['gimnasio', 'basico', 'casa']
export const INJURY_SETS: Injury[][] = [
  [],
  ['hombro'],
  ['rodilla'],
  ['espalda'],
  ['hombro', 'rodilla'],
  ['hombro', 'espalda'],
  ['rodilla', 'espalda'],
  ['hombro', 'rodilla', 'espalda'],
]

export function profileOf(p: Partial<Profile>): Profile {
  return {
    goal: 'hipertrofia',
    experience: 'menos1',
    situation: 'entreno',
    days: 4,
    minutes: 60,
    equipment: 'gimnasio',
    injuries: [],
    createdAt: '2026-11-07T00:00:00.000Z',
    age: '30-39',
    ...p,
  }
}

export function validateAgeGroup(age: AgeGroup) {
  for (const goal of GOALS) {
    for (const experience of EXPERIENCES) {
      it(`${age} · ${goal} · ${experience}: las 17 reglas en ${DAYS.length * MINUTES.length * EQUIPMENT.length * INJURY_SETS.length} encuestas`, () => {
        const problems: string[] = []
        let n = 0
        for (const days of DAYS) {
          for (const minutes of MINUTES) {
            for (const equipment of EQUIPMENT) {
              for (const injuries of INJURY_SETS) {
                const profile = profileOf({ goal, experience, age, days, minutes, equipment, injuries })
                const result = generatePlan(profile, { suggest: false })
                const where = `${days}×${minutes} ${equipment} [${injuries.join(',')}] (${result.mode})`
                for (const v of validatePlan(result)) problems.push(`regla ${v.rule} · ${where}: ${v.message}`)
                // Insufficient (not even the floor fits) only happens with 2 days of 30 minutes.
                if (result.mode === 'insuficiente' && !(days === 2 && minutes === 30)) problems.push(`insuficiente · ${where}`)
                // 17. Determinism: the same survey gives exactly the same routine (checked on every fourth survey).
                if (n++ % 4 === 0) {
                  const again = generatePlan(profile, { suggest: false })
                  if (JSON.stringify(again.plan) !== JSON.stringify(result.plan) || again.mode !== result.mode) {
                    problems.push(`regla 17 · ${where}: la misma encuesta dio otra rutina`)
                  }
                }
              }
            }
          }
        }
        expect(problems.slice(0, 25)).toEqual([])
      }, 300_000)
    }
  }
}
