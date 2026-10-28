import { useState } from 'react'
import { getExercise } from '../engine/exercises'
import {
  addDay,
  addExercise,
  moveExercise,
  removeDay,
  removeExercise,
  renameDay,
  replaceExercise,
  updateExercise,
} from '../engine/planEdit'
import type { Plan, Profile } from '../engine/types'
import { ExerciseEditor } from './ExerciseEditor'
import { AddExercisePicker, ExercisePicker } from './ExercisePicker'

interface Props {
  plan: Plan
  profile: Profile
  notes: Record<string, string>
  onChange: (plan: Plan) => void
}

const MAX_DAYS = 7

/** Edits a whole plan: days (name, add, remove) and their exercises. Works on any plan, saved or draft. */
export function PlanEditor({ plan, profile, notes, onChange }: Props) {
  const [editing, setEditing] = useState<{ dayId: string; index: number; swap?: boolean } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [removingDay, setRemovingDay] = useState<string | null>(null)

  const editingEntry = editing ? plan.days.find((d) => d.id === editing.dayId)?.exercises[editing.index] : undefined

  return (
    <div className="plan-editor">
      {plan.days.map((day) => (
        <div className="plan-day" key={day.id}>
          <div className="plan-day-head">
            {renaming === day.id ? (
              <DayNameInput
                initial={day.name}
                onDone={(name) => {
                  onChange(renameDay(plan, day.id, name))
                  setRenaming(null)
                }}
              />
            ) : (
              <button className="day-name" onClick={() => setRenaming(day.id)} aria-label={`Renombrar ${day.name}`}>
                <h3>{day.name}</h3>
                <span className="edit-hint">Renombrar</span>
              </button>
            )}
            {plan.days.length > 1 && renaming !== day.id && (
              <button className="link-muted" onClick={() => setRemovingDay(day.id)}>
                Quitar día
              </button>
            )}
          </div>

          {removingDay === day.id && (
            <div className="inline-confirm">
              <p className="small" style={{ margin: 0 }}>
                ¿Quitar {day.name}
                {day.exercises.length > 0 ? ` y sus ${day.exercises.length} ejercicios` : ''}? Tu historial se mantiene.
              </p>
              <div className="chips">
                <button
                  onClick={() => {
                    onChange(removeDay(plan, day.id))
                    setRemovingDay(null)
                  }}
                >
                  Quitar día
                </button>
                <button onClick={() => setRemovingDay(null)}>Mantener</button>
              </div>
            </div>
          )}

          {day.exercises.length === 0 ? (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              Sin ejercicios todavía.
            </p>
          ) : (
            <ol>
              {day.exercises.map((e, i) => (
                <li key={`${i}-${e.exerciseId}`}>
                  <button
                    className="plan-edit"
                    onClick={() => setEditing({ dayId: day.id, index: i })}
                    aria-label={`Editar ${getExercise(e.exerciseId).name}`}
                  >
                    <span>
                      {getExercise(e.exerciseId).name}
                      <span className="edit-hint">Editar</span>
                    </span>
                    <span className="num">
                      {e.sets} × {e.repMin}–{e.repMax}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <button className="add-exercise" onClick={() => setAdding(day.id)}>
            + Añadir ejercicio
          </button>
        </div>
      ))}

      {plan.days.length < MAX_DAYS && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={() => onChange(addDay(plan))}>
          + Añadir día
        </button>
      )}

      {editing && editingEntry && !editing.swap && (
        <ExerciseEditor
          plan={plan}
          dayId={editing.dayId}
          index={editing.index}
          note={notes[editingEntry.exerciseId] ?? ''}
          onUpdate={(patch) => onChange(updateExercise(plan, editing.dayId, editing.index, patch))}
          onMove={(delta) => {
            const day = plan.days.find((d) => d.id === editing.dayId)
            const to = editing.index + delta
            if (!day || to < 0 || to >= day.exercises.length) return
            onChange(moveExercise(plan, editing.dayId, editing.index, delta))
            setEditing({ ...editing, index: to })
          }}
          onRemove={() => onChange(removeExercise(plan, editing.dayId, editing.index))}
          onSwap={() => setEditing({ ...editing, swap: true })}
          onClose={() => setEditing(null)}
        />
      )}

      {editing && editingEntry && editing.swap && (
        <ExercisePicker
          plan={plan}
          profile={profile}
          dayId={editing.dayId}
          index={editing.index}
          currentId={editingEntry.exerciseId}
          mode="plan"
          onApply={(id) => {
            onChange(replaceExercise(plan, editing.dayId, editing.index, id))
            setEditing({ ...editing, swap: false })
          }}
          onClose={() => setEditing({ ...editing, swap: false })}
        />
      )}

      {adding && (
        <AddExercisePicker
          plan={plan}
          profile={profile}
          dayId={adding}
          onAdd={(id) => {
            onChange(addExercise(plan, adding, id, profile))
            setAdding(null)
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}

function DayNameInput({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <form
      className="day-rename"
      onSubmit={(e) => {
        e.preventDefault()
        onDone(value)
      }}
    >
      <input
        className="select"
        value={value}
        autoFocus
        maxLength={30}
        aria-label="Nombre del día"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onDone(value)}
      />
    </form>
  )
}
