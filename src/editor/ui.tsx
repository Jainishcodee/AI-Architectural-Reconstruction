import type { ReactNode } from 'react'
import { toFeet, fromFeet } from '../types'

export function Panel({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="border-b border-[#262c36]">
      <header className="flex items-center justify-between px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7c8798]">
          {title}
        </h2>
        {actions}
      </header>
      <div className="px-3 pb-3">{children}</div>
    </section>
  )
}

export function Button({
  children,
  onClick,
  active,
  disabled,
  tone = 'default',
  title,
  full,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger'
  title?: string
  full?: boolean
}) {
  const base =
    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed'
  const tones = {
    default: active
      ? 'bg-[#e8b04b] text-[#171b22]'
      : 'bg-[#222833] text-[#c7cdd8] hover:bg-[#2c333f]',
    primary: 'bg-[#e8b04b] text-[#171b22] hover:bg-[#f0bd63]',
    danger: 'bg-[#3a2226] text-[#f0a0a8] hover:bg-[#4a2b30]',
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${tones[tone]} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}

/**
 * Lengths are stored in metres but authored in feet — Indian decor is quoted,
 * sold and installed in feet, and asking a decorator to think in metres is a
 * needless tax on the one number they care about most.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}) {
  const isFeet = unit === 'ft'
  const shown = isFeet ? toFeet(value) : value
  const decimals = isFeet ? 1 : step < 0.1 ? 2 : step < 1 ? 1 : 0

  return (
    <label className="mb-2.5 block">
      <span className="mb-1 flex items-baseline justify-between text-xs text-[#9aa4b2]">
        {label}
        <span className="tabular-nums text-[#e7eaf0]">
          {shown.toFixed(decimals)}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function NumberField({
  label,
  value,
  unit,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  unit?: 'ft'
  onChange: (v: number) => void
  min?: number
}) {
  const shown = unit === 'ft' ? toFeet(value) : value
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-[#9aa4b2]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          className="w-full rounded-md border border-[#2c333f] bg-[#12161d] px-2 py-1.5 text-xs tabular-nums text-[#e7eaf0] outline-none focus:border-[#e8b04b]"
          value={Number(shown.toFixed(2))}
          min={min}
          step={0.1}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            onChange(unit === 'ft' ? fromFeet(v) : v)
          }}
        />
        {unit && <span className="text-xs text-[#7c8798]">{unit}</span>}
      </div>
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="mb-2.5 flex items-center justify-between gap-2">
      <span className="text-xs text-[#9aa4b2]">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-12 cursor-pointer rounded border border-[#2c333f] bg-transparent"
      />
    </label>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-xs text-[#9aa4b2]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#2c333f] bg-[#12161d] px-2 py-1.5 text-xs text-[#e7eaf0] outline-none focus:border-[#e8b04b]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Hint({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const cls =
    tone === 'warn'
      ? 'border-[#4a3a1c] bg-[#2a2113] text-[#e8c98b]'
      : 'border-[#2c333f] bg-[#171b22] text-[#8b96a6]'
  return (
    <p className={`rounded-md border px-2.5 py-2 text-[11px] leading-relaxed ${cls}`}>{children}</p>
  )
}
