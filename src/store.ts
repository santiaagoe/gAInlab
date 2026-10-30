import { useSyncExternalStore } from 'react'
import { getExercise, registerCustomExercises } from './engine/exercises'
import { buildPlan } from './engine/plan'
import { replaceExercise } from './engine/planEdit'
import { cleanEdited, prepareExercise, toSession, type TrainingContext } from './engine/session'
import type { CustomExercise, Feel, Kind, Muscle, Plan, PlanDay, Profile, Session, SetLog, Settings } from './engine/types'
import { CORRUPT_KEY, initialState, parseState, PREVIOUS_KEY, STORAGE_KEY, type AppState } from './persistence'

export type { ActiveExercise, ActiveSession } from './engine/types'
export type { AppState } from './persistence'
export { nextDay } from './engine/session'

/** Problems the user should know about. Not saved. */
export interface StoreStatus {
  /** The last change could not be saved on this device (storage full or blocked). */
  persistError: boolean
  /** Saved data could not be read in full when the app opened; the original was kept in CORRUPT_KEY. */
  loadIssue: 'corrupt' | 'partial' | null
}

/* ---------- Storage access that never throws ---------- */

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/* ---------- Load ---------- */

function load(): { state: AppState; loadIssue: StoreStatus['loadIssue'] } {
  const raw = readKey(STORAGE_KEY)
  if (!raw) return { state: initialState(), loadIssue: null }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    // Keep the original before anything overwrites it.
    writeKey(CORRUPT_KEY, raw)
    return { state: initialState(), loadIssue: 'corrupt' }
  }
  const result = parseState(json)
  if (!result.ok) {
    writeKey(CORRUPT_KEY, raw)
    return { state: initialState(), loadIssue: 'corrupt' }
  }
  if (result.dropped > 0) {
    writeKey(CORRUPT_KEY, raw)
    return { state: result.state, loadIssue: 'partial' }
  }
  return { state: result.state, loadIssue: null }
}

const loaded = load()
let state: AppState = loaded.state
let status: StoreStatus = { persistError: false, loadIssue: loaded.loadIssue }
registerCustomExercises(state.customExercises)
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function setStatus(patch: Partial<StoreStatus>) {
  const next = { ...status, ...patch }
  if (next.persistError === status.persistError && next.loadIssue === status.loadIssue) return
  status = next
}

function persist() {
  setStatus({ persistError: !writeKey(STORAGE_KEY, JSON.stringify(state)) })
}

function set(next: AppState) {
  if (next.customExercises !== state.customExercises) registerCustomExercises(next.customExercises)
  state = next
  persist()
  notify()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, () => state)
}

export function useStoreStatus(): StoreStatus {
  return useSyncExternalStore(subscribe, () => status)
}

export function getState(): AppState {
  return state
}

export function getStatus(): StoreStatus {
  return status
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function context(): TrainingContext {
  return { sessions: state.sessions, settings: state.settings, age: state.profile?.age }
}

/** Keeps the current saved data so a restore or a reset can be undone. */
function keepPrevious() {
  writeKey(PREVIOUS_KEY, readKey(STORAGE_KEY) ?? JSON.stringify(state))
}

export type ImportResult = { ok: true; sessions: number } | { ok: false; message: string }

export const actions = {
  /** Saves the survey answers with the plan the user approved (generated, edited or built from scratch). */
  completeOnboarding(profile: Profile, plan: Plan = buildPlan(profile)) {
    set({ ...state, profile, plan, active: undefined })
  },

  setPlan(plan: Plan) {
    set({ ...state, plan })
  },

  /** Updates profile answers that don't rebuild the plan (e.g. age). */
  updateProfile(patch: Partial<Profile>) {
    if (!state.profile) return
    set({ ...state, profile: { ...state.profile, ...patch } })
  },

  /** Creates an exercise that is not in the library and returns its id. */
  createExercise(name: string, kind: Kind, muscle: Muscle, compound: boolean): string {
    const id = `custom-${uid()}`
    const exercise: CustomExercise = { id, name: name.trim(), kind, muscle, compound }
    set({ ...state, customExercises: [...state.customExercises, exercise] })
    return id
  },

  updateSettings(settings: Settings) {
    set({ ...state, settings })
  },

  startSession(day: PlanDay) {
    const ctx = context()
    const now = new Date()
    const exercises = day.exercises.map((plan) => prepareExercise(ctx, plan, plan.exerciseId, now))
    set({
      ...state,
      active: { id: uid(), startedAt: now.toISOString(), dayId: day.id, dayName: day.name, exercises, current: 0 },
    })
  },

  updateSet(exIndex: number, setIndex: number, patch: Partial<SetLog>) {
    actions.updateSets(exIndex, [{ index: setIndex, patch }])
  },

  /** Several set changes of one exercise saved at once (e.g. a new weight carried to the following sets). */
  updateSets(exIndex: number, changes: { index: number; patch: Partial<SetLog> }[]) {
    const active = state.active
    if (!active || changes.length === 0) return
    const exercises = active.exercises.map((ex, i) => {
      if (i !== exIndex) return ex
      const sets = ex.sets.map((s, j) => {
        const forThis = changes.filter((c) => c.index === j)
        return forThis.length === 0 ? s : forThis.reduce((acc, c) => ({ ...acc, ...c.patch }), s)
      })
      return { ...ex, sets }
    })
    set({ ...state, active: { ...active, exercises } })
  },

  addSet(exIndex: number) {
    const active = state.active
    if (!active) return
    const exercises = active.exercises.map((ex, i) => {
      if (i !== exIndex) return ex
      const last = ex.sets[ex.sets.length - 1]
      return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? ex.plan.repMin, done: false }] }
    })
    set({ ...state, active: { ...active, exercises } })
  },

  setFeel(exIndex: number, feel: Feel) {
    const active = state.active
    if (!active) return
    const exercises = active.exercises.map((ex, i) => (i === exIndex ? { ...ex, feel } : ex))
    set({ ...state, active: { ...active, exercises } })
  },

  /** Swaps an exercise in the running session; with `inPlan` the routine changes too. */
  swapExercise(exIndex: number, exerciseId: string, inPlan = false) {
    const active = state.active
    if (!active) return
    if (inPlan && state.plan) actions.setPlan(replaceExercise(state.plan, active.dayId, exIndex, exerciseId))
    const ctx = context()
    const exercises = active.exercises.map((ex, i) =>
      i === exIndex ? prepareExercise(ctx, { ...ex.plan, slot: getExercise(exerciseId).slot }, exerciseId) : ex,
    )
    set({ ...state, active: { ...active, exercises } })
  },

  setCurrent(index: number) {
    const active = state.active
    if (!active) return
    const current = Math.max(0, Math.min(active.exercises.length - 1, index))
    set({ ...state, active: { ...active, current } })
  },

  setNote(exerciseId: string, text: string) {
    const notes = { ...state.notes }
    if (text.trim()) notes[exerciseId] = text.trim()
    else delete notes[exerciseId]
    set({ ...state, notes })
  },

  /** Saves corrections to a past session; a session left without sets is removed. */
  replaceSession(session: Session) {
    const clean = cleanEdited(session)
    const sessions = clean
      ? state.sessions.map((s) => (s.id === session.id ? clean : s))
      : state.sessions.filter((s) => s.id !== session.id)
    set({ ...state, sessions })
  },

  /** Saves the running session and returns what was saved, or null when no set was marked. */
  finishSession(): Session | null {
    const active = state.active
    if (!active) return null
    const session = toSession(active)
    const sessions = session ? [...state.sessions, session] : state.sessions
    set({ ...state, sessions, active: undefined })
    return session
  },

  discardSession() {
    set({ ...state, active: undefined })
  },

  deleteSession(id: string) {
    set({ ...state, sessions: state.sessions.filter((s) => s.id !== id) })
  },

  /** Replaces all data with a backup after validating it. The current data is kept so it can be restored. */
  importData(raw: unknown): ImportResult {
    const result = parseState(raw)
    if (!result.ok) return { ok: false, message: result.error }
    if (result.dropped > 0) {
      return { ok: false, message: 'El respaldo tiene datos dañados o incompletos. No cambiamos nada.' }
    }
    if (result.unknownExercises.length > 0) {
      return {
        ok: false,
        message: 'El respaldo usa ejercicios que esta versión de gAInlab no conoce. Actualiza la app y vuelve a intentarlo.',
      }
    }
    keepPrevious()
    set({ ...result.state, active: undefined })
    return { ok: true, sessions: result.state.sessions.length }
  },

  /** True when there is a copy from before the last restore or reset. */
  hasPrevious(): boolean {
    return readKey(PREVIOUS_KEY) !== null
  },

  /** Goes back to the data from before the last restore or reset; the replaced data becomes the new copy. */
  restorePrevious(): boolean {
    const raw = readKey(PREVIOUS_KEY)
    if (!raw) return false
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return false
    }
    const result = parseState(json)
    if (!result.ok) return false
    keepPrevious()
    set(result.state)
    return true
  },

  resetAll() {
    keepPrevious()
    set(initialState())
  },

  dismissLoadIssue() {
    setStatus({ loadIssue: null })
    notify()
  },
}

/** Backup of the current data, without the session in progress. */
export function exportData(): string {
  return JSON.stringify({ ...state, active: undefined }, null, 2)
}

/** Everything saved on this device as it is, for the emergency screen. Falls back to the data in memory. */
export function rawSavedData(): string {
  return readKey(STORAGE_KEY) ?? exportData()
}

/** The original data that could not be read when the app opened, if any. */
export function corruptData(): string | null {
  return readKey(CORRUPT_KEY)
}
