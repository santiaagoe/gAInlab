import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/v0.4-state.json'
import { reviewPlan } from './engine/coverage'
import { getExercise, musclesOf, registerCustomExercises } from './engine/exercises'
import { prescriptionFor } from './engine/session'
import { contextFor } from './engine/targets'
import type { Profile } from './engine/types'
import { CURRENT_VERSION, parseState, PRE_V2_KEY, STORAGE_KEY } from './persistence'

/**
 * `__fixtures__/v0.4-state.json` is what the v0.4 app (commit 2f39158) saved in localStorage after onboarding,
 * three custom exercises (two with the old "hombro" muscle), one of them added to the plan, notes, settings,
 * 8 finished sessions and a session left open. It was produced by running that code, not written by hand.
 */
const original = () => structuredClone(fixture) as unknown as Record<string, unknown> & typeof fixture

function memoryStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  registerCustomExercises([])
})

describe('migración de datos v0.4 (versión 1) a v0.5 (versión 2)', () => {
  it('no pierde nada: solo cambia el músculo "hombro" de los ejercicios propios', () => {
    const r = parseState(original())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dropped).toBe(0)
    expect(r.unknownExercises).toEqual([])
    const before = original()
    expect(r.state.version).toBe(CURRENT_VERSION)
    expect(r.state.profile).toEqual(before.profile)
    expect(r.state.plan).toEqual(before.plan)
    expect(r.state.sessions).toEqual(before.sessions)
    expect(r.state.sessions).toHaveLength(8)
    expect(r.state.notes).toEqual(before.notes)
    expect(r.state.settings).toEqual(before.settings)
    expect(r.state.active).toEqual(before.active)
    expect(r.state.customExercises).toEqual(
      before.customExercises.map((c) => (c.muscle === 'hombro' ? { ...c, muscle: 'deltLateral' } : c)),
    )
    expect(r.state.customExercises.map((c) => c.muscle)).toEqual(['deltLateral', 'deltLateral', 'espalda'])
  })

  it('es idempotente: migrar lo ya migrado no cambia nada', () => {
    const once = parseState(original())
    expect(once.ok).toBe(true)
    if (!once.ok) return
    const twice = parseState(JSON.parse(JSON.stringify(once.state)))
    expect(twice.ok && twice.state).toEqual(once.state)
  })

  it('un respaldo antiguo importado pasa por la misma migración', () => {
    const r = parseState({ ...original(), version: undefined })
    expect(r.ok && r.state.customExercises[0].muscle).toBe('deltLateral')
  })

  it('el plan, el historial y los ejercicios propios siguen funcionando con el motor nuevo', () => {
    const r = parseState(original())
    if (!r.ok) throw new Error(r.error)
    registerCustomExercises(r.state.customExercises)
    const custom = r.state.customExercises[0]
    expect(getExercise(custom.id)).toMatchObject({ name: 'Press Arnold', custom: true })
    expect(musclesOf(getExercise(custom.id))).toEqual(['deltLateral'])
    // Every exercise in the old plan still exists, and the history still drives the next prescription.
    const day = r.state.plan!.days[0]
    for (const e of day.exercises) expect(getExercise(e.exerciseId).unknown).toBeUndefined()
    const bench = day.exercises.find((e) => e.exerciseId === 'banca-barra')!
    const rx = prescriptionFor({ sessions: r.state.sessions, settings: r.state.settings }, bench, new Date('2026-10-25T18:00:00Z'))
    expect(rx.mode).not.toBe('calibracion')
    expect(rx.weight).toBeGreaterThan(0)
    // The coverage review reads the old plan: it was built without core work.
    const review = reviewPlan(contextFor(r.state.profile as Profile), r.state.plan!)
    expect(review.belowMin).toContain('core')
  })

  it('al abrir la app guarda una copia intacta de los datos antiguos, una sola vez', async () => {
    const raw = JSON.stringify(original())
    const storage = memoryStorage({ [STORAGE_KEY]: raw })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const store = await import('./store')
    expect(storage.data.get(PRE_V2_KEY)).toBe(raw)
    const state = store.getState()
    expect(state.version).toBe(CURRENT_VERSION)
    expect(state.sessions).toHaveLength(8)
    expect(state.active?.dayName).toBe('Torso A')
    // The next save writes the new format; reopening does not touch the copy.
    store.actions.setNote('banca-barra', 'agarre medio, banco en 4')
    expect(JSON.parse(storage.data.get(STORAGE_KEY)!).version).toBe(CURRENT_VERSION)
    vi.resetModules()
    await import('./store')
    expect(storage.data.get(PRE_V2_KEY)).toBe(raw)
  })
})

describe('regenerar el plan desde la pantalla del plan', () => {
  it('cambia días o minutos y arma un plan nuevo, sin tocar historial, notas ni la sesión abierta', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(original()) })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const store = await import('./store')
    const before = store.getState()
    expect(before.plan?.engine).toBeUndefined()
    store.actions.regeneratePlan({ days: 3 })
    const after = store.getState()
    expect(after.profile?.days).toBe(3)
    expect(after.plan?.engine?.version).toBe(2)
    expect(after.plan?.days).toHaveLength(3)
    expect(after.sessions).toEqual(before.sessions)
    expect(after.notes).toEqual(before.notes)
    expect(after.customExercises).toEqual(before.customExercises)
    expect(after.active).toEqual(before.active)
  })

  it('respeta el ajuste del tope de días de fuerza', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(original()) })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const store = await import('./store')
    store.actions.regeneratePlan({ days: 6 })
    expect(store.getState().plan?.days).toHaveLength(4)
    store.actions.updateSettings({ ...store.getState().settings, capStrengthDays: false })
    store.actions.regeneratePlan()
    expect(store.getState().plan?.days).toHaveLength(6)
    // The setting survives reopening the app.
    vi.resetModules()
    const reopened = await import('./store')
    expect(reopened.getState().settings.capStrengthDays).toBe(false)
    expect(reopened.getState().plan?.engine).toEqual({ version: 2, mode: 'completo' })
  })
})
