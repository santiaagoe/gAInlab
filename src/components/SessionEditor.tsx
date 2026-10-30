import { useState } from 'react'
import { findExercise } from '../engine/exercises'
import type { Feel, Session, SetLog } from '../engine/types'
import { FEEL_OPTIONS } from '../format'
import { actions } from '../store'
import { Sheet } from './Sheet'
import { IconClose } from './Icons'
import { NumField } from './NumField'

/** Fix or delete a saved session. Changes recalculate the next prescriptions automatically. */
export function SessionEditor({ session, onClose }: { session: Session; onClose: () => void }) {
  const [draft, setDraft] = useState<Session>(() => structuredClone(session))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const date = new Date(session.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  const patchSet = (ei: number, si: number, patch: Partial<SetLog>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })),
    }))

  const removeSet = (ei: number, si: number) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })),
    }))

  const addSet = (ei: number) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e, i) => {
        if (i !== ei) return e
        const last = e.sets[e.sets.length - 1]
        return { ...e, sets: [...e.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? e.repMin, done: true }] }
      }),
    }))

  const setFeel = (ei: number, feel: Feel) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === ei ? { ...e, feel } : e)) }))

  // A loaded exercise saved with 0 kg would be treated as bodyweight from then on.
  const missingWeight = (exerciseId: string, s: SetLog) => {
    const kind = findExercise(exerciseId)?.kind
    return kind !== undefined && kind !== 'corporal' && s.reps > 0 && s.weight <= 0
  }
  const hasErrors = draft.exercises.some((e) => e.sets.some((s) => missingWeight(e.exerciseId, s)))

  const save = () => {
    if (hasErrors) {
      setShowErrors(true)
      return
    }
    actions.replaceSession(draft)
    onClose()
  }

  if (confirmDelete) {
    return (
      <Sheet onClose={() => setConfirmDelete(false)}>
        <h2>¿Borrar esta sesión?</h2>
        <p className="muted small">
          {session.dayName}, {date}. Tus próximas prescripciones se calcularán sin ella. No se puede deshacer.
        </p>
        <div className="sheet-actions">
          <button
            className="btn btn-danger"
            onClick={() => {
              actions.deleteSession(session.id)
              onClose()
            }}
          >
            Borrar sesión
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>
        {date}
      </p>
      <h2>{session.dayName}</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Corrige pesos o repeticiones mal anotados. La app recalcula tus próximas sesiones con los datos corregidos.
      </p>

      {draft.exercises.map((ex, ei) => (
        <div className="edit-ex" key={`${ei}-${ex.exerciseId}`}>
          <h3>{findExercise(ex.exerciseId)?.name ?? 'Ejercicio no encontrado'}</h3>
          {ex.sets.map((s, si) => (
            <div className="edit-set-row" key={si}>
              <span className="idx num muted small">{si + 1}</span>
              <NumField
                value={s.weight}
                unit="kg"
                decimal
                invalid={showErrors && missingWeight(ex.exerciseId, s)}
                label={`Peso serie ${si + 1}`}
                onChange={(v) => patchSet(ei, si, { weight: v })}
              />
              <NumField value={s.reps} unit="reps" label={`Repeticiones serie ${si + 1}`} onChange={(v) => patchSet(ei, si, { reps: v })} />
              <button className="remove" onClick={() => removeSet(ei, si)} aria-label={`Quitar serie ${si + 1}`}>
                <IconClose />
              </button>
            </div>
          ))}
          <button className="add-set" onClick={() => addSet(ei)}>
            + Añadir serie
          </button>
          <div className="chips" role="group" aria-label="Cómo se sintió" style={{ marginTop: 6 }}>
            {FEEL_OPTIONS.map(({ value, label, hint }) => (
              <button key={value} aria-pressed={ex.feel === value} onClick={() => setFeel(ei, value)} title={hint}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {showErrors && hasErrors && (
        <p className="small" style={{ color: 'var(--down)', margin: '8px 0 0' }}>
          Anota el peso de las series marcadas. Si no la hiciste, quítala.
        </p>
      )}
      <div className="sheet-actions">
        <button className="btn btn-primary" onClick={save}>
          Guardar cambios
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
          Borrar sesión
        </button>
      </div>
    </Sheet>
  )
}
