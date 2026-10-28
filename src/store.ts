import { useSyncExternalStore } from 'react'
import { buildPlan } from './engine/plan'
import { historyFor, prescribe } from './engine/progression'
import type { Feel, Plan, PlanDay, PlanExercise, Prescription, Profile, Session, SetLog, Settings } from './engine/types'

export interface ActiveExercise {
  plan: PlanExercise
  exerciseId: string
  prescription: Prescription
  sets: SetLog[]
  feel?: Feel
}

export interface ActiveSession {
  id: string
  startedAt: string
  dayId: string
  dayName: string
  exercises: ActiveExercise[]
}

export interface AppState {
  version: 1
  profile?: Profile
  plan?: Plan
  sessions: Session[]
  settings: Settings
  active?: ActiveSession
}

const KEY = 'gainlab:v1'

const DEFAULT_SETTINGS: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5 }

function initial(): AppState {
  return { version: 1, sessions: [], settings: DEFAULT_SETTINGS }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial()
    const parsed = JSON.parse(raw) as AppState
    return { ...initial(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
  } catch {
    return initial()
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

function set(next: AppState) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getState(): AppState {
  return state
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const actions = {
  completeOnboarding(profile: Profile) {
    set({ ...state, profile, plan: buildPlan(profile), active: undefined })
  },

  updateSettings(settings: Settings) {
    set({ ...state, settings })
  },

  startSession(day: PlanDay) {
    const exercises: ActiveExercise[] = day.exercises.map((plan) => prepareExercise(plan, plan.exerciseId))
    set({
      ...state,
      active: { id: uid(), startedAt: new Date().toISOString(), dayId: day.id, dayName: day.name, exercises },
    })
  },

  updateSet(exIndex: number, setIndex: number, patch: Partial<SetLog>) {
    const active = state.active
    if (!active) return
    const exercises = active.exercises.map((ex, i) =>
      i !== exIndex ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) },
    )
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

  swapExercise(exIndex: number, exerciseId: string) {
    const active = state.active
    if (!active) return
    const exercises = active.exercises.map((ex, i) => (i === exIndex ? prepareExercise(ex.plan, exerciseId) : ex))
    set({ ...state, active: { ...active, exercises } })
  },

  finishSession() {
    const active = state.active
    if (!active) return
    const session: Session = {
      id: active.id,
      date: new Date().toISOString(),
      dayId: active.dayId,
      dayName: active.dayName,
      exercises: active.exercises
        .filter((ex) => ex.sets.some((s) => s.done))
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          repMin: ex.plan.repMin,
          repMax: ex.plan.repMax,
          feel: ex.feel,
          sets: ex.sets.filter((s) => s.done),
        })),
    }
    const sessions = session.exercises.length > 0 ? [...state.sessions, session] : state.sessions
    set({ ...state, sessions, active: undefined })
  },

  discardSession() {
    set({ ...state, active: undefined })
  },

  deleteSession(id: string) {
    set({ ...state, sessions: state.sessions.filter((s) => s.id !== id) })
  },

  importData(data: AppState) {
    set({ ...initial(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings }, active: undefined })
  },

  resetAll() {
    set(initial())
  },
}

function prepareExercise(plan: PlanExercise, exerciseId: string): ActiveExercise {
  const target = { ...plan, exerciseId }
  const prescription = prescribe(target, historyFor(exerciseId, state.sessions), state.settings)
  // In calibration the reps start empty so the user logs what they actually did.
  const calibrating = prescription.mode === 'calibracion'
  const sets: SetLog[] = prescription.reps.map((reps) => ({
    weight: prescription.weight ?? 0,
    reps: calibrating ? 0 : reps,
    done: false,
  }))
  return { plan: target, exerciseId, prescription, sets }
}

/** Next day in the rotation: the one after the last completed day. */
export function nextDay(plan: Plan, sessions: Session[]): PlanDay {
  const last = sessions[sessions.length - 1]
  if (!last) return plan.days[0]
  const index = plan.days.findIndex((d) => d.id === last.dayId)
  return plan.days[(index + 1) % plan.days.length]
}

export function exportData(): string {
  return JSON.stringify({ ...state, active: undefined }, null, 2)
}
