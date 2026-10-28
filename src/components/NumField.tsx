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
}

/** Numeric field that accepts "52,5" or "52.5" and keeps what the user is typing until it loses focus. */
export function NumField({ value, unit, decimal, placeholder, invalid, label, onChange }: Props) {
  const [text, setText] = useState(value > 0 ? kg(value) : '')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(value > 0 ? kg(value) : '')
  }, [value])

  return (
    <label className={`field${invalid ? ' invalid' : ''}`}>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          focused.current = true
          e.target.select()
        }}
        onBlur={() => {
          focused.current = false
          setText(value > 0 ? kg(value) : '')
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
