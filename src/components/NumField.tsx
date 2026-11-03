import { useEffect, useRef, useState } from 'react'
import { kg } from '../format'

interface Props {
  value: number
  unit: string
  decimal?: boolean
  placeholder?: string
  invalid?: boolean
  label: string
  onChange: (v: number) => void
  /** Called when the user is done with the field (leaves it or taps "Listo"), with whether the value changed. */
  onCommit?: (changed: boolean) => void
}

/** Numeric field that accepts "52,5" or "52.5" and keeps what the user is typing until it loses focus. */
export function NumField({ value, unit, decimal, placeholder, invalid, label, onChange, onCommit }: Props) {
  const [text, setText] = useState(value > 0 ? kg(value) : '')
  const focused = useRef(false)
  const atFocus = useRef(value)
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
    if (!focused.current) setText(value > 0 ? kg(value) : '')
  }, [value])

  return (
    <label className={`field${invalid ? ' invalid' : ''}`}>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        enterKeyHint={onCommit ? 'done' : undefined}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          focused.current = true
          atFocus.current = value
          e.target.select()
        }}
        onBlur={() => {
          focused.current = false
          setText(value > 0 ? kg(value) : '')
          // Read the newest value: the parent may not have re-rendered with it yet.
          onCommit?.(latest.current !== atFocus.current)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '')
          setText(raw)
          const parsed = parseFloat(raw.replace(',', '.'))
          onChange(Number.isFinite(parsed) ? (decimal ? parsed : Math.round(parsed)) : 0)
        }}
      />
      <span>{unit}</span>
    </label>
  )
}
