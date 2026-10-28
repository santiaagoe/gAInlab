import { useMemo, useState } from 'react'
import {
  allExercises,
  getExercise,
  isAvoided,
  listMuscles,
  mainMuscle,
  MUSCLE_NAMES,
  MUSCLE_ORDER,
  musclesOf,
} from '../engine/exercises'
import { entryFor } from '../engine/plan'
import { checkSwap, type SwapLevel } from '../engine/swap'
import type { Exercise, Kind, Muscle, Plan, Profile, Slot } from '../engine/types'
import { actions } from '../store'

interface Props {
  plan: Plan
  profile: Profile
  dayId: string
  index: number
  /** The exercise currently in that position (may differ from the plan during a session). */
  currentId: string
  /** "session" offers "Solo hoy" besides changing the routine. */
  mode: 'session' | 'plan'
  onApply: (exerciseId: string, inPlan: boolean) => void
  onClose: () => void
}

const TONE: Record<SwapLevel, string> = { igual: 'up', parecido: 'ai', distinto: 'down', bloqueado: 'down' }

/** Replace the exercise at one position of a day. */
export function ExercisePicker({ plan, profile, dayId, index, currentId, mode, onApply, onClose }: Props) {
  const [chosen, setChosen] = useState<string | null>(null)
  const current = getExercise(currentId)
  const day = plan.days.find((d) => d.id === dayId)
  const taken = new Set(day?.exercises.map((e, i) => (i === index ? '' : e.exerciseId)))

  // The comparison uses what is in that position right now, even if it was swapped just for today.
  const effectivePlan: Plan = useMemo(
    () => ({
      ...plan,
      days: plan.days.map((d) =>
        d.id !== dayId ? d : { ...d, exercises: d.exercises.map((e, i) => (i === index ? { ...e, exerciseId: currentId } : e)) },
      ),
    }),
    [plan, dayId, index, currentId],
  )

  if (chosen) {
    const next = getExercise(chosen)
    const check = checkSwap(effectivePlan, dayId, index, chosen, profile.injuries)
    const blocked = check.level === 'bloqueado'
    return (
      <Sheet onClose={onClose}>
        <p className="muted small" style={{ margin: 0 }}>
          {current.name} por
        </p>
        <h2>{next.name}</h2>
        <div className={`note ${TONE[check.level]}`}>{check.title}</div>
        {check.warnings.map((w) => (
          <div className="note down" key={w}>
            {w}
          </div>
        ))}
        {!blocked && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Mantiene las mismas series y repeticiones. Si es la primera vez que lo haces, empezará con una sesión de calibración.
          </p>
        )}
        <div className="sheet-actions">
          {!blocked && mode === 'session' && (
            <button className="btn btn-ghost" onClick={() => onApply(chosen, false)}>
              Solo hoy
            </button>
          )}
          {!blocked && (
            <button className="btn btn-primary" onClick={() => onApply(chosen, true)}>
              Cambiar en mi rutina
            </button>
          )}
          <button className="link" style={{ padding: 8 }} onClick={() => setChosen(null)}>
            Elegir otro ejercicio
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Cambiar {current.name.toLowerCase()}</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Trabaja {listMuscles(musclesOf(current))}. Cada ejercicio guarda su propio progreso.
      </p>
      <ExerciseList profile={profile} exclude={currentId} taken={taken} sameSlot={current.slot} onPick={setChosen} />
      <div className="sheet-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Sheet>
  )
}

/** Add a new exercise at the end of a day. */
export function AddExercisePicker({
  plan,
  profile,
  dayId,
  onAdd,
  onClose,
}: {
  plan: Plan
  profile: Profile
  dayId: string
  onAdd: (exerciseId: string) => void
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  const day = plan.days.find((d) => d.id === dayId)
  const taken = new Set(day?.exercises.map((e) => e.exerciseId))

  if (chosen && day) {
    const next = getExercise(chosen)
    const entry = entryFor(profile, next)
    const risky = isAvoided(next, profile.injuries)
    return (
      <Sheet onClose={onClose}>
        <p className="muted small" style={{ margin: 0 }}>
          Añadir a {day.name}
        </p>
        <h2>{next.name}</h2>
        <div className="note ai">
          Trabaja {listMuscles(musclesOf(next))}. Se añade al final con {entry.sets} series de {entry.repMin}–{entry.repMax}{' '}
          repeticiones; puedes ajustarlo después.
        </div>
        {risky.length > 0 && <div className="note down">Suele cargar una zona donde marcaste molestias.</div>}
        {day.exercises.length >= 7 && (
          <div className="note down">Este día ya tiene {day.exercises.length} ejercicios: la sesión se alargará.</div>
        )}
        <div className="sheet-actions">
          <button className="btn btn-primary" onClick={() => onAdd(chosen)}>
            Añadir a {day.name}
          </button>
          <button className="link" style={{ padding: 8 }} onClick={() => setChosen(null)}>
            Elegir otro ejercicio
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose}>
      <h2>Añadir ejercicio{day ? ` a ${day.name}` : ''}</h2>
      <ExerciseList profile={profile} taken={taken} onPick={setChosen} />
      <div className="sheet-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Sheet>
  )
}

function ExerciseList({
  profile,
  exclude,
  taken,
  sameSlot,
  onPick,
}: {
  profile: Profile
  exclude?: string
  taken: Set<string>
  sameSlot?: Slot
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  if (creating) {
    return <CreateExercise initialName={query} onCancel={() => setCreating(false)} onCreated={onPick} />
  }

  const available = allExercises().filter((e) => e.equip.includes(profile.equipment) && e.id !== exclude)
  const q = normalize(query.trim())
  const matches = q ? available.filter((e) => normalize(`${e.name} ${listMuscles(musclesOf(e))}`).includes(q)) : available
  const mine = matches.filter((e) => e.custom)
  const library = matches.filter((e) => !e.custom)
  const sameZone = sameSlot ? library.filter((e) => e.slot === sameSlot) : []
  const groups = MUSCLE_ORDER.map((m) => ({
    muscle: m,
    items: library.filter((e) => mainMuscle(e) === m && e.slot !== sameSlot),
  })).filter((g) => g.items.length > 0)

  const createButton = (
    <button className="pick create" onClick={() => setCreating(true)}>
      <span className="pick-name">+ Crear {query.trim() ? `“${query.trim()}”` : 'un ejercicio nuevo'}</span>
      <span className="pick-meta">Si tu ejercicio no está en la lista</span>
    </button>
  )

  return (
    <>
      <input
        className="select search"
        type="search"
        placeholder="Buscar ejercicio o músculo"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar ejercicio o músculo"
      />
      {(q || mine.length > 0) && <div className="pick-group">{createButton}</div>}
      {mine.length > 0 && (
        <div className="pick-group">
          <h3>Tus ejercicios</h3>
          {mine.map((e) => (
            <PickItem key={e.id} exercise={e} profile={profile} taken={taken.has(e.id)} onPick={onPick} />
          ))}
        </div>
      )}
      {sameZone.length > 0 && (
        <div className="pick-group">
          <h3>Misma zona</h3>
          {sameZone.map((e) => (
            <PickItem key={e.id} exercise={e} profile={profile} taken={taken.has(e.id)} onPick={onPick} />
          ))}
        </div>
      )}
      {groups.map((g) => (
        <div className="pick-group" key={g.muscle}>
          <h3>{capitalize(MUSCLE_NAMES[g.muscle])}</h3>
          {g.items.map((e) => (
            <PickItem key={e.id} exercise={e} profile={profile} taken={taken.has(e.id)} onPick={onPick} />
          ))}
        </div>
      ))}
      {matches.length === 0 && (
        <div className="empty" style={{ marginTop: 16 }}>
          No hay ejercicios que coincidan con “{query}”. Puedes crearlo con el botón de arriba.
        </div>
      )}
      {!q && mine.length === 0 && <div className="pick-group">{createButton}</div>}
    </>
  )
}

const KINDS: [Kind, string][] = [
  ['barra', 'Barra'],
  ['mancuerna', 'Mancuernas'],
  ['maquina', 'Máquina o polea'],
  ['corporal', 'Peso corporal'],
]

function CreateExercise({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState(capitalize(initialName.trim()))
  const [kind, setKind] = useState<Kind | null>(null)
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [compound, setCompound] = useState<boolean | null>(null)
  const [tried, setTried] = useState(false)
  const clean = name.trim()
  const duplicate = clean && allExercises().some((e) => normalize(e.name) === normalize(clean))
  const ready = clean.length >= 2 && kind && muscle && compound !== null && !duplicate

  return (
    <div className="create-form">
      <div className="editor-row">
        <label className="label" htmlFor="new-ex-name">
          Nombre
        </label>
        <input
          id="new-ex-name"
          className="select"
          value={name}
          placeholder="Ej.: Press Hammer inclinado"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {duplicate && <p className="small" style={{ color: 'var(--down)', margin: '6px 0 0' }}>Ya existe un ejercicio con ese nombre.</p>}
      </div>
      <div className="editor-row">
        <span className="label">Con qué se hace</span>
        <div className="chips" role="group" aria-label="Con qué se hace">
          {KINDS.map(([k, label]) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="editor-row">
        <span className="label">Músculo que más trabaja</span>
        <div className="chips" role="group" aria-label="Músculo que más trabaja">
          {MUSCLE_ORDER.map((m) => (
            <button key={m} aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
              {capitalize(MUSCLE_NAMES[m])}
            </button>
          ))}
        </div>
      </div>
      <div className="editor-row">
        <span className="label">Tipo de ejercicio</span>
        <div className="chips" role="group" aria-label="Tipo de ejercicio">
          <button aria-pressed={compound === true} onClick={() => setCompound(true)}>
            Básico<small>press, remo, sentadilla</small>
          </button>
          <button aria-pressed={compound === false} onClick={() => setCompound(false)}>
            Aislamiento<small>curl, extensión, aperturas</small>
          </button>
        </div>
      </div>
      {tried && !ready && !duplicate && (
        <p className="small" style={{ color: 'var(--down)', margin: '10px 0 0' }}>
          Completa el nombre y elige una opción en cada grupo.
        </p>
      )}
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            setTried(true)
            if (!ready) return
            onCreated(actions.createExercise(clean, kind!, muscle!, compound!))
          }}
        >
          Crear ejercicio
        </button>
        <button className="link" style={{ padding: 8 }} onClick={onCancel}>
          Volver a la lista
        </button>
      </div>
    </div>
  )
}

function PickItem({
  exercise,
  profile,
  taken,
  onPick,
}: {
  exercise: Exercise
  profile: Profile
  taken: boolean
  onPick: (id: string) => void
}) {
  const risky = isAvoided(exercise, profile.injuries).length > 0
  return (
    <button className="pick" disabled={taken} onClick={() => onPick(exercise.id)}>
      <span className="pick-name">{exercise.name}</span>
      <span className="pick-meta">
        {taken ? 'Ya está en este día' : listMuscles(musclesOf(exercise))}
        {risky && !taken && <span className="pick-warn"> Puede molestar tu lesión</span>}
      </span>
    </button>
  )
}

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
