import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerCustomExercises } from './engine/exercises'
import { buildPlan } from './engine/plan'
import { prescriptionFor } from './engine/session'
import type { Profile } from './engine/types'
import { CORRUPT_KEY, PREVIOUS_KEY, STORAGE_KEY } from './persistence'

/** In-memory localStorage; `full` makes every write fail like a full or blocked storage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const storage = {
    full: false,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (storage.full) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  return storage
}

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

async function freshStore(initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial)
  vi.stubGlobal('localStorage', storage)
  vi.resetModules()
  const store = await import('./store')
  return { store, storage }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-02T18:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  registerCustomExercises([])
})

describe('store: sessions', () => {
  it('saves a session and corrections to it change the next prescription', async () => {
    const { store } = await freshStore()
    const { actions, getState } = store
    actions.completeOnboarding(profile)
    const day = getState().plan!.days[0]
    actions.startSession(day)
    // Log the first exercise: 3 × 10 with 50 kg.
    for (let i = 0; i < 3; i++) actions.updateSet(0, i, { weight: 50, reps: 10, done: true })
    const saved = actions.finishSession()
    expect(saved?.exercises).toHaveLength(1)
    expect(getState().sessions).toHaveLength(1)

    const pe = day.exercises[0]
    const ctx = () => ({ sessions: getState().sessions, settings: getState().settings, age: profile.age })
    expect(prescriptionFor(ctx(), pe).weight).toBe(50)

    // Correct the history: it was 60 kg, at the top of the range.
    const fixed = structuredClone(saved!)
    fixed.exercises[0].sets = fixed.exercises[0].sets.map((s) => ({ ...s, weight: 60, reps: 12 }))
    actions.replaceSession(fixed)
    expect(prescriptionFor(ctx(), pe)).toMatchObject({ mode: 'subir', weight: 62.5 })

    // Emptying every set removes the session.
    fixed.exercises[0].sets = fixed.exercises[0].sets.map((s) => ({ ...s, reps: 0 }))
    actions.replaceSession(fixed)
    expect(getState().sessions).toHaveLength(0)
  })

  it('finishing without marked sets saves nothing and returns null', async () => {
    const { store } = await freshStore()
    store.actions.completeOnboarding(profile)
    store.actions.startSession(store.getState().plan!.days[0])
    expect(store.actions.finishSession()).toBeNull()
    expect(store.getState().sessions).toHaveLength(0)
    expect(store.getState().active).toBeUndefined()
  })

  it('applies several set changes in one save', async () => {
    const { store, storage } = await freshStore()
    store.actions.completeOnboarding(profile)
    store.actions.startSession(store.getState().plan!.days[0])
    const spy = vi.spyOn(storage, 'setItem')
    store.actions.updateSets(0, [
      { index: 0, patch: { weight: 40 } },
      { index: 1, patch: { weight: 40 } },
      { index: 2, patch: { weight: 40 } },
    ])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.getState().active!.exercises[0].sets.map((s) => s.weight)).toEqual([40, 40, 40])
  })
})

describe('store: saving and loading', () => {
  it('keeps the original when saved data cannot be parsed', async () => {
    const { store, storage } = await freshStore({ [STORAGE_KEY]: '{roto' })
    expect(store.getState().sessions).toEqual([])
    expect(store.getStatus().loadIssue).toBe('corrupt')
    expect(storage.getItem(CORRUPT_KEY)).toBe('{roto')
    store.actions.completeOnboarding(profile)
    // The copy survives the first save.
    expect(storage.getItem(CORRUPT_KEY)).toBe('{roto')
  })

  it('opens with what can be read when part of the data is broken', async () => {
    const data = {
      version: 1,
      profile,
      plan: buildPlan(profile),
      sessions: [{ id: 'x', date: 'mal', dayId: 'd1', dayName: 'x', exercises: [] }],
      settings: {},
      notes: {},
      customExercises: [],
    }
    const { store, storage } = await freshStore({ [STORAGE_KEY]: JSON.stringify(data) })
    expect(store.getState().plan).toBeDefined()
    expect(store.getState().sessions).toEqual([])
    expect(store.getStatus().loadIssue).toBe('partial')
    expect(storage.getItem(CORRUPT_KEY)).toBe(JSON.stringify(data))
    store.actions.dismissLoadIssue()
    expect(store.getStatus().loadIssue).toBeNull()
  })

  it('reports when a change could not be saved, and clears it once saving works again', async () => {
    const { store, storage } = await freshStore()
    storage.full = true
    store.actions.completeOnboarding(profile)
    expect(store.getStatus().persistError).toBe(true)
    // The app keeps working in memory.
    expect(store.getState().profile).toEqual(profile)
    storage.full = false
    store.actions.updateSettings({ ...store.getState().settings, sessionView: 'lista' })
    expect(store.getStatus().persistError).toBe(false)
  })
})

describe('store: backups', () => {
  it('rejects an invalid backup without touching the current data', async () => {
    const { store, storage } = await freshStore()
    store.actions.completeOnboarding(profile)
    const before = storage.getItem(STORAGE_KEY)
    const r = store.actions.importData({ version: 1, sessions: [], plan: { name: 'x', days: [] } })
    expect(r.ok).toBe(false)
    expect(storage.getItem(STORAGE_KEY)).toBe(before)
    expect(storage.getItem(PREVIOUS_KEY)).toBeNull()
  })

  it('rejects a backup whose plan uses unknown exercises', async () => {
    const { store } = await freshStore()
    const plan = buildPlan(profile)
    plan.days[0].exercises[0].exerciseId = 'no-existe'
    const r = store.actions.importData({ version: 1, profile, plan, sessions: [], settings: {}, notes: {}, customExercises: [] })
    expect(r).toMatchObject({ ok: false })
    expect(store.getState().plan).toBeUndefined()
  })

  it('restores a backup, can undo it, and keeps custom exercises available', async () => {
    const { store } = await freshStore()
    store.actions.completeOnboarding(profile)
    const mine = store.getState().plan
    const plan = buildPlan({ ...profile, days: 4 })
    plan.days[0].exercises[0].exerciseId = 'custom-z'
    const backup = {
      version: 1,
      profile: { ...profile, days: 4 },
      plan,
      sessions: [],
      settings: {},
      notes: {},
      customExercises: [{ id: 'custom-z', name: 'Mi press', kind: 'maquina', muscle: 'pecho', compound: true }],
    }
    expect(store.actions.importData(backup)).toEqual({ ok: true, sessions: 0 })
    expect(store.getState().plan!.days).toHaveLength(4)
    const { getExercise } = await import('./engine/exercises')
    expect(getExercise('custom-z').name).toBe('Mi press')

    expect(store.actions.restorePrevious()).toBe(true)
    expect(store.getState().plan).toEqual(mine)
  })

  it('a reset can be undone from the copy', async () => {
    const { store } = await freshStore()
    store.actions.completeOnboarding(profile)
    store.actions.resetAll()
    expect(store.getState().profile).toBeUndefined()
    expect(store.actions.hasPrevious()).toBe(true)
    store.actions.restorePrevious()
    expect(store.getState().profile).toEqual(profile)
  })
})
