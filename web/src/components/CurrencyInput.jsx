import { useEffect, useRef, useState } from 'react'
import { fmtMoney } from '../lib/api'
import { parseCurrencyInput } from '../lib/currency'

export default function CurrencyInput({ value, currency = 'BRL', onChange, ...props }) {
  const focused = useRef(false)
  const [text, setText] = useState(() => value === '' || value == null ? '' : fmtMoney(value, currency))

  useEffect(() => {
    if (focused.current) return
    setText(value === '' || value == null ? '' : fmtMoney(value, currency))
  }, [value, currency])

  function commit(raw) {
    const parsed = parseCurrencyInput(raw)
    onChange?.(parsed)
    setText(parsed === '' ? '' : fmtMoney(parsed, currency))
  }

  return <input
    {...props}
    type="text"
    inputMode="decimal"
    value={text}
    onFocus={() => { focused.current = true }}
    onChange={event => {
      setText(event.target.value)
      onChange?.(parseCurrencyInput(event.target.value))
    }}
    onBlur={event => {
      focused.current = false
      commit(event.target.value)
    }}
  />
}
