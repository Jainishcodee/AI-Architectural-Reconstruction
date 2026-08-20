import { useState } from 'react'
import { useActiveSpace, useScene } from '../store/sceneStore'
import { fromFeet, toFeet } from '../types'
import { Button, Hint, SelectField } from './ui'

type Ref = 'width' | 'depth' | 'height'

const LABELS: Record<Ref, string> = {
  width: 'Back wall width',
  depth: 'Room depth (front to back)',
  height: 'Ceiling height',
}

/**
 * Fixes the scene's absolute scale from a single real measurement.
 *
 * Dragging the walls sets the room's *proportions*; this sets its *size*. They
 * are separate acts, which is why this is not just another width field: it
 * rescales every dimension and every placed item together, preserving the shape
 * the user already dialled in.
 */
export function ScaleCalibrator({ onClose }: { onClose: () => void }) {
  const venue = useActiveSpace((s) => s.venue)
  const applyCalibration = useScene((s) => s.applyCalibration)
  const calibrated = useActiveSpace((s) => s.calibrated)
  const [ref, setRef] = useState<Ref>('width')
  const [feet, setFeet] = useState(() => toFeet(venue.width).toFixed(0))

  const current = venue[ref]
  const entered = Number(feet)
  const valid = Number.isFinite(entered) && entered > 0
  const factor = valid ? fromFeet(entered) / current : 1

  const apply = () => {
    if (!valid) return
    applyCalibration(current, fromFeet(entered))
    onClose()
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-xl border border-[#2c333f] bg-[#171b22] p-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-[#e7eaf0]">Set the real size</h3>
        <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-[#7c8798]">
          Pick one thing in the venue you actually know the size of. Everything else scales
          with it, keeping the shape you have already set up.
        </p>

        <SelectField
          label="I know the…"
          value={ref}
          options={(Object.keys(LABELS) as Ref[])
            .filter((k) => venue.mode === 'indoor' || k !== 'height')
            .map((k) => ({ value: k, label: LABELS[k] }))}
          onChange={(v) => {
            setRef(v as Ref)
            setFeet(toFeet(venue[v as Ref]).toFixed(0))
          }}
        />

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-[#9aa4b2]">Real measurement</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={feet}
              min={1}
              step={0.5}
              autoFocus
              onChange={(e) => setFeet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              className="w-full rounded-md border border-[#2c333f] bg-[#12161d] px-2.5 py-2 text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#e8b04b]"
            />
            <span className="text-sm text-[#7c8798]">ft</span>
          </div>
        </label>

        {valid && Math.abs(factor - 1) > 0.005 && (
          <div className="mb-3">
            <Hint>
              Scene will be resized {factor > 1 ? 'up' : 'down'} by {(factor * 100 - 100).toFixed(0)}%
              — the room becomes {toFeet(venue.width * factor).toFixed(0)} ×{' '}
              {toFeet(venue.depth * factor).toFixed(0)} ft
              {venue.mode === 'indoor' && `, ${toFeet(venue.height * factor).toFixed(0)} ft high`}.
            </Hint>
          </div>
        )}

        {!calibrated && (
          <div className="mb-3">
            <Hint tone="warn">
              Until this is set, every quantity in the bill of materials is guesswork.
            </Hint>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" disabled={!valid} onClick={apply}>
            Set scale
          </Button>
        </div>
      </div>
    </div>
  )
}
