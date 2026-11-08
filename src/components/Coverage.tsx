import { useMemo, useState } from 'react'
import { generatePlan } from '../engine/generator'
import { coverageReport, type PlanNotice } from '../engine/notice'
import { engineOptions } from '../engine/plan'
import type { Plan, Profile, Settings } from '../engine/types'
import { Sheet } from './Sheet'

/** Warning for a reduced or insufficient plan, with one-tap fixes (+1 day, +15 minutes). */
export function PlanNoticeCard({ notice, onApply }: { notice: PlanNotice; onApply: (patch: NoticePatch) => void }) {
  return (
    <div className="coverage-card" role="status">
      <p className="coverage-title">{notice.title}</p>
      <p className="coverage-body">{notice.body}</p>
      {notice.actions.length > 0 ? (
        <>
          <p className="coverage-body muted">Para un plan completo:</p>
          <div className="coverage-actions">
            {notice.actions.map((a) => (
              <button key={a.label} className="btn btn-ghost btn-block" onClick={() => onApply(a.patch)}>
                {a.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        notice.hint && <p className="coverage-body muted">{notice.hint}</p>
      )}
    </div>
  )
}

export type NoticePatch = Partial<Pick<Profile, 'days' | 'minutes'>>

interface ReviewProps {
  plan: Plan
  profile: Profile
  settings: Settings
  onClose: () => void
  /** Replaces the plan with a new one; the caller keeps the history. */
  onRegenerate: () => void
}

/** "Revisar cobertura": what the current plan covers, and the option to generate a new one. */
export function CoverageSheet({ plan, profile, settings, onClose, onRegenerate }: ReviewProps) {
  const [confirm, setConfirm] = useState(false)
  const cap = engineOptions(settings).capStrengthDays
  const report = useMemo(() => coverageReport(profile, plan, { capStrengthDays: cap }), [profile, plan, cap])
  const next = useMemo(() => (confirm ? generatePlan(profile, { capStrengthDays: cap }) : null), [confirm, profile, cap])

  return (
    <Sheet onClose={onClose}>
      <h2>Cobertura de tu plan</h2>
      <p className="lede small">{report.title}</p>
      {report.below.length > 0 && (
        <ul className="coverage-list" aria-label="Bajo el volumen recomendado">
          {report.below.map((l) => (
            <li key={l.muscle}>
              <span>{l.name}</span>
              <span className="num muted">
                {l.sets} de {l.minimum} series
              </span>
            </li>
          ))}
        </ul>
      )}
      {report.notes.map((n) => (
        <p key={n} className="small" style={{ margin: '10px 0 0' }}>
          {n}
        </p>
      ))}
      {report.below.length > 0 && <p className="small muted">Series por semana. Las de ejercicios compuestos cuentan a medias para los músculos que ayudan.</p>}

      <div className="sheet-actions">
        {!confirm ? (
          <>
            {!report.ok && !plan.custom && (
              <button className="btn btn-primary btn-block" onClick={() => setConfirm(true)}>
                Ver un plan nuevo
              </button>
            )}
            <button className="btn btn-ghost btn-block" onClick={onClose}>
              {report.ok ? 'Listo' : 'Mantener mi rutina'}
            </button>
          </>
        ) : (
          next && (
            <>
              <p className="small" style={{ margin: 0 }}>
                {next.mode === 'completo'
                  ? `Un plan nuevo con tus respuestas cubre los 12 grupos musculares.`
                  : `Un plan nuevo con tus respuestas también sería una versión reducida.`}{' '}
                {plan.edited ? 'Reemplaza tu rutina y los cambios que le hiciste.' : 'Reemplaza tu rutina actual.'} Tu historial se mantiene.
              </p>
              <button className="btn btn-primary btn-block" onClick={onRegenerate}>
                Usar el plan nuevo
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setConfirm(false)}>
                Mantener mi rutina
              </button>
            </>
          )
        )}
      </div>
    </Sheet>
  )
}
