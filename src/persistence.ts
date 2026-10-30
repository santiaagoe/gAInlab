import { isLibraryExercise } from './engine/exercises'
import type {
  ActiveExercise,
  ActiveSession,
  AgeGroup,
  CustomExercise,
  Equipment,
  ExerciseLog,
  Experience,
  Feel,
  Goal,
  Injury,
  Kind,
  Muscle,
  Plan,
  PlanDay,
  PlanExercise,
  Prescription,
  PrescriptionMode,
  Profile,
  Role,
  Session,
  SetLog,
  Settings,
  Situation,
  Slot,
} from './engine/types'

/**
 * Saved data: format version, migrations and validation.
 * `parseState` is the only way data enters the app, from localStorage or from a backup.
 */

export const STORAGE_KEY = 'gainlab:v1'
/** State before the last restore or reset, to undo it. */
export const PREVIOUS_KEY = 'gainlab:v1:prev'
/** Raw saved data that could not be read in full, kept so nothing is lost. */
export const CORRUPT_KEY = 'gainlab:v1:corrupt'

export const CURRENT_VERSION = 1

export interface AppState {
  version: number
  profile?: Profile
  plan?: Plan
  sessions: Session[]
  settings: Settings
  active?: ActiveSession
  /** Personal notes per exercise (seat height, technique cues...). */
  notes: Record<string, string>
  /** Exercises the user created because they were not in the library. */
  customExercises: CustomExercise[]
}

export const DEFAULT_SETTINGS: Settings = { incBarra: 2.5, incMancuerna: 2, incMaquina: 2.5, sessionView: 'enfoque' }

export function initialState(): AppState {
  return { version: CURRENT_VERSION, sessions: [], settings: { ...DEFAULT_SETTINGS }, notes: {}, customExercises: [] }
}

type Raw = Record<string, unknown>

/**
 * migrations[n] turns data saved with version n into version n + 1.
 * When the format changes: bump CURRENT_VERSION, add the step here and a test for it.
 */
export type Migration = (data: Raw) => Raw
export const MIGRATIONS: Record<number, Migration> = {}

export class StateError extends Error {}

/** Brings saved data up to the current version. Data without a version is from v0.1–0.4 (version 1). */
export function migrate(data: Raw, migrations: Record<number, Migration> = MIGRATIONS, target = CURRENT_VERSION): Raw {
  let version = data.version === undefined ? 1 : data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new StateError('El archivo no indica una versión válida.')
  }
  if (version > target) {
    throw new StateError('Este respaldo es de una versión más nueva de gAInlab. Actualiza la app y vuelve a intentarlo.')
  }
  let out = data
  while (version < target) {
    const step = migrations[version]
    if (!step) throw new StateError(`No sabemos actualizar datos de la versión ${version}.`)
    out = step(out)
    version++
  }
  return { ...out, version: target }
}

/* ---------- Field checks ---------- */

const GOALS: Record<Goal, true> = { hipertrofia: true, grasa: true, fuerza: true, salud: true }
const AGES: Record<AgeGroup, true> = { menor: true, '18-29': true, '30-39': true, '40-49': true, '50-59': true, '60-69': true, '70+': true }
const EXPERIENCE: Record<Experience, true> = { nuevo: true, menos1: true, mas1: true }
const SITUATIONS: Record<Situation, true> = { entreno: true, regreso: true, cero: true }
const EQUIPMENT: Record<Equipment, true> = { gimnasio: true, basico: true, casa: true }
const INJURIES: Record<Injury, true> = { hombro: true, rodilla: true, espalda: true }
const FEELS: Record<Feel, true> = { facil: true, justo: true, limite: true }
const KINDS: Record<Kind, true> = { barra: true, mancuerna: true, maquina: true, corporal: true }
const ROLES: Record<Role, true> = { principal: true, secundario: true, accesorio: true }
const MUSCLES: Record<Muscle, true> = {
  cuadriceps: true,
  gluteo: true,
  femoral: true,
  gemelo: true,
  pecho: true,
  espalda: true,
  hombro: true,
  biceps: true,
  triceps: true,
}
const SLOTS: Record<Slot, true> = {
  sentadilla: true,
  bisagra: true,
  pressHorizontal: true,
  pressVertical: true,
  remo: true,
  jalon: true,
  unilateral: true,
  cuadriceps: true,
  femoral: true,
  gemelo: true,
  pecho: true,
  lateral: true,
  biceps: true,
  triceps: true,
}
const MODES: Record<PrescriptionMode, true> = {
  calibracion: true,
  subir: true,
  mantener: true,
  repetir: true,
  bajar: true,
  regreso: true,
  ajuste: true,
}

function isObj(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isStr(v: unknown): v is string {
  return typeof v === 'string'
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
function isInt(v: unknown, min: number, max = Infinity): v is number {
  return isNum(v) && Number.isInteger(v) && v >= min && v <= max
}
function oneOf<T extends string>(table: Record<T, true>, v: unknown): v is T {
  return isStr(v) && Object.hasOwn(table, v)
}
function isDate(v: unknown): v is string {
  return isStr(v) && !Number.isNaN(new Date(v).getTime())
}

/** Counts what had to be dropped to make the data usable. */
class Report {
  dropped = 0
  unknownExercises = new Set<string>()
}

function parseSet(v: unknown): SetLog | null {
  if (!isObj(v) || !isNum(v.weight) || v.weight < 0 || !isNum(v.reps) || v.reps < 0 || typeof v.done !== 'boolean') return null
  return { weight: v.weight, reps: v.reps, done: v.done }
}

function parseSets(v: unknown, report: Report): SetLog[] | null {
  if (!Array.isArray(v)) return null
  const out: SetLog[] = []
  for (const item of v) {
    const s = parseSet(item)
    if (s) out.push(s)
    else report.dropped++
  }
  return out
}

function parseLog(v: unknown, report: Report): ExerciseLog | null {
  if (!isObj(v) || !isStr(v.exerciseId)) return null
  const sets = parseSets(v.sets, report)
  if (!sets || sets.length === 0) return null
  // Very old logs may lack the range: the progression then falls back to the plan's.
  const log = { exerciseId: v.exerciseId, sets } as ExerciseLog
  if (isInt(v.repMin, 1)) log.repMin = v.repMin
  if (isInt(v.repMax, 1)) log.repMax = v.repMax
  if (oneOf(FEELS, v.feel)) log.feel = v.feel
  if (isNum(v.recoverTo) && v.recoverTo > 0) log.recoverTo = v.recoverTo
  return log
}

function parseSession(v: unknown, report: Report): Session | null {
  if (!isObj(v) || !isStr(v.id) || !isDate(v.date) || !isStr(v.dayId) || !isStr(v.dayName) || !Array.isArray(v.exercises)) return null
  const exercises: ExerciseLog[] = []
  for (const item of v.exercises) {
    const log = parseLog(item, report)
    if (log) exercises.push(log)
    else report.dropped++
  }
  if (exercises.length === 0) return null
  return { id: v.id, date: v.date, dayId: v.dayId, dayName: v.dayName, exercises }
}

function parsePlanExercise(v: unknown, report: Report): PlanExercise | null {
  if (
    !isObj(v) ||
    !isStr(v.exerciseId) ||
    !oneOf(SLOTS, v.slot) ||
    !oneOf(ROLES, v.role) ||
    !isInt(v.sets, 1, 20) ||
    !isInt(v.repMin, 1, 100) ||
    !isInt(v.repMax, 1, 100) ||
    v.repMax < v.repMin ||
    !isNum(v.rest) ||
    v.rest < 0
  ) {
    return null
  }
  report.unknownExercises.add(v.exerciseId)
  return { exerciseId: v.exerciseId, slot: v.slot, role: v.role, sets: v.sets, repMin: v.repMin, repMax: v.repMax, rest: v.rest }
}

function parsePlanExercises(v: unknown, report: Report): PlanExercise[] | null {
  if (!Array.isArray(v)) return null
  const out: PlanExercise[] = []
  for (const item of v) {
    const e = parsePlanExercise(item, report)
    if (e) out.push(e)
    else report.dropped++
  }
  return out
}

function parseDay(v: unknown, report: Report): PlanDay | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) return null
  const exercises = parsePlanExercises(v.exercises, report)
  if (!exercises) return null
  return { id: v.id, name: v.name, focus: isStr(v.focus) ? v.focus : '', exercises }
}

function parsePlan(v: unknown, report: Report): Plan | null {
  if (!isObj(v) || !isStr(v.name) || !Array.isArray(v.days)) return null
  const days: PlanDay[] = []
  const ids = new Set<string>()
  for (const item of v.days) {
    const day = parseDay(item, report)
    if (day && !ids.has(day.id)) {
      days.push(day)
      ids.add(day.id)
    } else {
      report.dropped++
    }
  }
  if (days.length === 0) return null
  const plan: Plan = { name: v.name, summary: isStr(v.summary) ? v.summary : '', days }
  if (v.edited === true) plan.edited = true
  if (v.custom === true) plan.custom = true
  return plan
}

function parseProfile(v: unknown): Profile | null {
  if (
    !isObj(v) ||
    !oneOf(GOALS, v.goal) ||
    !oneOf(EXPERIENCE, v.experience) ||
    !oneOf(SITUATIONS, v.situation) ||
    !oneOf(EQUIPMENT, v.equipment) ||
    !isInt(v.days, 1, 7) ||
    !isNum(v.minutes) ||
    v.minutes <= 0 ||
    !Array.isArray(v.injuries)
  ) {
    return null
  }
  const profile: Profile = {
    goal: v.goal,
    experience: v.experience,
    situation: v.situation,
    days: v.days,
    minutes: v.minutes,
    equipment: v.equipment,
    injuries: v.injuries.filter((i): i is Injury => oneOf(INJURIES, i)),
    createdAt: isDate(v.createdAt) ? v.createdAt : new Date(0).toISOString(),
  }
  if (oneOf(AGES, v.age)) profile.age = v.age
  return profile
}

function parseSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {}
  const inc = (x: unknown, fallback: number) => (isNum(x) && x > 0 && x <= 50 ? x : fallback)
  return {
    incBarra: inc(s.incBarra, DEFAULT_SETTINGS.incBarra),
    incMancuerna: inc(s.incMancuerna, DEFAULT_SETTINGS.incMancuerna),
    incMaquina: inc(s.incMaquina, DEFAULT_SETTINGS.incMaquina),
    sessionView: s.sessionView === 'lista' ? 'lista' : 'enfoque',
  }
}

function parseNotes(v: unknown): Record<string, string> {
  if (!isObj(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, text] of Object.entries(v)) if (isStr(text) && text.trim()) out[k] = text
  return out
}

function parseCustom(v: unknown, report: Report): CustomExercise[] {
  if (!Array.isArray(v)) return []
  const out: CustomExercise[] = []
  const ids = new Set<string>()
  for (const c of v) {
    if (
      isObj(c) &&
      isStr(c.id) &&
      !isLibraryExercise(c.id) &&
      !ids.has(c.id) &&
      isStr(c.name) &&
      c.name.trim() &&
      oneOf(KINDS, c.kind) &&
      oneOf(MUSCLES, c.muscle) &&
      typeof c.compound === 'boolean'
    ) {
      out.push({ id: c.id, name: c.name, kind: c.kind, muscle: c.muscle, compound: c.compound })
      ids.add(c.id)
    } else {
      report.dropped++
    }
  }
  return out
}

function parsePrescription(v: unknown, report: Report): Prescription | null {
  if (
    !isObj(v) ||
    !oneOf(MODES, v.mode) ||
    !(v.weight === null || isNum(v.weight)) ||
    !Array.isArray(v.reps) ||
    !v.reps.every(isNum) ||
    !isNum(v.delta) ||
    !isStr(v.note)
  ) {
    return null
  }
  const p: Prescription = { mode: v.mode, weight: v.weight as number | null, reps: v.reps as number[], delta: v.delta, note: v.note }
  if (isObj(v.last) && isDate(v.last.date)) {
    const log = parseLog(v.last.log, report)
    if (log) p.last = { date: v.last.date, log }
  }
  if (isNum(v.recoverTo) && v.recoverTo > 0) p.recoverTo = v.recoverTo
  return p
}

function parseActiveExercise(v: unknown, report: Report): ActiveExercise | null {
  if (!isObj(v) || !isStr(v.exerciseId)) return null
  const plan = parsePlanExercise(v.plan, report)
  const prescription = parsePrescription(v.prescription, report)
  const sets = parseSets(v.sets, report)
  if (!plan || !prescription || !sets || sets.length === 0) return null
  const ex: ActiveExercise = { plan, exerciseId: v.exerciseId, prescription, sets }
  if (oneOf(FEELS, v.feel)) ex.feel = v.feel
  return ex
}

function parseActive(v: unknown, report: Report): ActiveSession | null {
  if (!isObj(v) || !isStr(v.id) || !isDate(v.startedAt) || !isStr(v.dayId) || !isStr(v.dayName) || !Array.isArray(v.exercises)) {
    return null
  }
  const exercises: ActiveExercise[] = []
  for (const item of v.exercises) {
    const ex = parseActiveExercise(item, report)
    if (!ex) return null
    exercises.push(ex)
  }
  if (exercises.length === 0) return null
  const active: ActiveSession = { id: v.id, startedAt: v.startedAt, dayId: v.dayId, dayName: v.dayName, exercises }
  if (isInt(v.current, 0)) active.current = Math.min(v.current, exercises.length - 1)
  return active
}

/* ---------- Entry point ---------- */

export type ParseResult =
  | { ok: true; state: AppState; /** Items that were invalid and left out. */ dropped: number; unknownExercises: string[] }
  | { ok: false; error: string }

/**
 * Validates and normalizes saved data. Broken pieces (a session, a set, an exercise of the plan) are left out and
 * counted in `dropped`, so the caller decides whether that is acceptable. `unknownExercises` lists plan entries
 * whose exercise is neither in the library nor among the custom exercises of the same data.
 */
export function parseState(raw: unknown): ParseResult {
  if (!isObj(raw)) return { ok: false, error: 'El archivo no tiene datos de gAInlab.' }
  let data: Raw
  try {
    data = migrate(raw)
  } catch (e) {
    return { ok: false, error: e instanceof StateError ? e.message : 'No pudimos leer los datos.' }
  }
  if (!Array.isArray(data.sessions)) return { ok: false, error: 'El archivo no tiene un historial de sesiones.' }

  const report = new Report()
  const sessions: Session[] = []
  for (const item of data.sessions) {
    const s = parseSession(item, report)
    if (s) sessions.push(s)
    else report.dropped++
  }

  const state: AppState = {
    version: CURRENT_VERSION,
    sessions,
    settings: parseSettings(data.settings),
    notes: parseNotes(data.notes),
    customExercises: parseCustom(data.customExercises, report),
  }

  if (data.profile !== undefined) {
    const profile = parseProfile(data.profile)
    if (profile) state.profile = profile
    else report.dropped++
  }
  if (data.plan !== undefined) {
    const plan = parsePlan(data.plan, report)
    if (plan) state.plan = plan
    else report.dropped++
  }
  if (data.active !== undefined && data.active !== null) {
    const active = parseActive(data.active, report)
    if (active) state.active = active
    else report.dropped++
  }

  const custom = new Set(state.customExercises.map((c) => c.id))
  const unknownExercises = [...report.unknownExercises].filter((id) => !isLibraryExercise(id) && !custom.has(id))
  return { ok: true, state, dropped: report.dropped, unknownExercises }
}
