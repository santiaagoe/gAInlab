import { AGE_GROUPS, AGE_LABELS } from '../engine/age'
import type { AgeGroup } from '../engine/types'

/** Age group chips. */
export function AgePicker({
  value,
  onPick,
  style,
}: {
  value?: AgeGroup
  onPick: (age: AgeGroup) => void
  style?: React.CSSProperties
}) {
  return (
    <div className="chips" role="group" aria-label="Edad" style={style}>
      {AGE_GROUPS.map((g) => (
        <button key={g} aria-pressed={value === g} onClick={() => onPick(g)}>
          {AGE_LABELS[g]}
        </button>
      ))}
    </div>
  )
}
