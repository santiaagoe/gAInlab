import { useState } from 'react'
import { getExercise, listMuscles, musclesOf } from '../engine/exercises'
import { checkRemoval } from '../engine/swap'
import type { Plan } from '../engine/types'
import { actions } from '../store'
import { Sheet } from './ExercisePicker'

const RANGES: [number, number][] = [
  [4, 6],
  [6, 8],
  [8, 12],
  [10, 15],
  [12, 20],
]

const RANGE_HINT: Record<string, string> = {
  '4-6': 'fuerza',
  '6-8': 'fuerza y músculo',
  '8-12': 'músculo',
  '10-15': 'músculo',
  '12-20': 'resistencia',
}

const RESTS = [60, 90, 120, 150, 180, 240]

interface Props {
  plan: Plan
  dayId: string
  index: number
  note: string
  onSwap: () => void
  onClose: () => void
}

/** Edit one exercise of the routine: sets, rep range, rest, note; replace or remove it. */
export function ExerciseEditor({ plan, dayId, index, note, onSwap, onClose }: Props) {
  const day = plan.days.find((d) => d.id === dayId)
  const entry = day?.exercises[index]
  const [text, setText] = useState(note)
  const [removing, setRemoving] = useState(false)
  if (!day || !entry) return null

  const ex = getExercise(entry.exerciseId)
  const ranges = RANGES.some(([a, b]) => a === entry.repMin && b === entry.repMax)
    ? RANGES
    : [...RANGES, [entry.repMin, entry.repMax] as [number, number]]
  const update = (patch: Parameters<typeof actions.updatePlanExercise>[2]) => actions.updatePlanExercise(dayId, index, patch)
  const saveNote = () => {
    if (text.trim() !== note) actions.setNote(entry.exerciseId, text)
  }
  const close = () => {
    saveNote()
    onClose()
  }

  if (removing) {
    const only = day.exercises.length === 1
    const warnings = checkRemoval(plan, dayId, index)
    return (
      <Sheet onClose={() => setRemoving(false)}>
        <h2>¿Quitar {ex.name.toLowerCase()} de {day.name}?</h2>
        {only ? (
          <div className="note down">Es el único ejercicio del día. Añade otro antes de quitar este.</div>
        ) : warnings.length > 0 ? (
          warnings.map((w) => (
            <div className="note down" key={w}>
              {w}
            </div>
          ))
        ) : (
          <div className="note up">Los músculos que trabaja siguen cubiertos por otros ejercicios de tu semana.</div>
        )}
        <p className="small muted">Su historial se conserva por si lo vuelves a añadir.</p>
        <div className="sheet-actions">
          {!only && (
            <button
              className="btn btn-danger"
              onClick={() => {
                actions.removeFromPlan(dayId, index)
                onClose()
              }}
            >
              Quitar de {day.name}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setRemoving(false)}>
            Mantenerlo
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={close}>
      <p className="muted small" style={{ margin: 0 }}>
        {day.name}, ejercicio {index + 1}
      </p>
      <h2>{ex.name}</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Trabaja {listMuscles(musclesOf(ex))}
      </p>

      <div className="editor-row">
        <span className="label">Series</span>
        <div className="stepper">
          <button onClick={() => update({ sets: entry.sets - 1 })} disabled={entry.sets <= 1} aria-label="Una serie menos">
            −
          </button>
          <output className="num" aria-live="polite">
            {entry.sets}
          </output>
          <button onClick={() => update({ sets: entry.sets + 1 })} disabled={entry.sets >= 8} aria-label="Una serie más">
            +
          </button>
        </div>
      </div>

      <div className="editor-row">
        <span className="label">Rango de repeticiones</span>
        <div className="chips" role="group" aria-label="Rango de repeticiones">
          {ranges.map(([a, b]) => (
            <button
              key={`${a}-${b}`}
              aria-pressed={entry.repMin === a && entry.repMax === b}
              onClick={() => update({ repMin: a, repMax: b })}
            >
              {a}–{b}
              {RANGE_HINT[`${a}-${b}`] && <small>{RANGE_HINT[`${a}-${b}`]}</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-row">
        <span className="label">Descanso entre series</span>
        <div className="chips" role="group" aria-label="Descanso entre series">
          {RESTS.map((r) => (
            <button key={r} aria-pressed={entry.rest === r} onClick={() => update({ rest: r })}>
              {Math.floor(r / 60)}:{String(r % 60).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-row">
        <label className="label" htmlFor="ex-note">
          Nota
        </label>
        <textarea
          id="ex-note"
          className="textarea"
          rows={2}
          value={text}
          placeholder="Ej.: asiento en el 4, agarre cerrado"
          onChange={(e) => setText(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={close}>
          Listo
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            saveNote()
            onSwap()
          }}
        >
          Cambiar por otro ejercicio
        </button>
        <button className="btn btn-danger" onClick={() => setRemoving(true)}>
          Quitar de {day.name}
        </button>
      </div>
    </Sheet>
  )
}
