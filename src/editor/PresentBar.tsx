import { useMemo } from 'react'
import { DECOR_BY_ID } from '../decor/registry'
import { LIGHTING } from '../scene/lighting'
import { useActiveSpace, useScene, type LightingPreset } from '../store/sceneStore'
import { toFeet } from '../types'
import { venueDepth, venueWidth } from '../lib/wings'
import { Button } from './ui'

const PRESETS = Object.keys(LIGHTING) as LightingPreset[]

const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/**
 * Client-facing view.
 *
 * Everything that says "software" — panels, gizmos, resize nubs, sliders — is
 * gone, leaving the room, a light switch and the price. A decorator showing this
 * on a laptop across a table is the moment the tool either wins the job or does
 * not, and an editor UI in frame makes it look like a work in progress rather
 * than a proposal.
 */
export function PresentBar() {
  const items = useActiveSpace((s) => s.items)
  const venue = useActiveSpace((s) => s.venue)
  const lighting = useActiveSpace((s) => s.lighting)
  const cameraMode = useScene((s) => s.cameraMode)
  const calibrated = useActiveSpace((s) => s.calibrated)
  const setLighting = useScene((s) => s.setLighting)
  const setCameraMode = useScene((s) => s.setCameraMode)
  const setPresenting = useScene((s) => s.setPresenting)
  const spaces = useScene((s) => s.spaces)
  const activeSpaceId = useScene((s) => s.activeSpaceId)
  const setActiveSpace = useScene((s) => s.setActiveSpace)
  const activeName = useActiveSpace((s) => s.name)

  // Same 30% default the BOM panel opens with, so the two never disagree.
  const priceOf = (list: typeof items) => {
    let sum = 0
    for (const item of list) {
      const def = DECOR_BY_ID.get(item.type)
      if (!def) continue
      for (const line of def.bom(item.params)) sum += Math.ceil(line.qty) * line.rate
    }
    return sum * 1.3
  }

  const total = useMemo(() => priceOf(items), [items])
  // The client is buying the event, not the room they happen to be looking at.
  const eventTotal = useMemo(
    () => spaces.reduce((sum, sp) => sum + priceOf(sp.items), 0),
    [spaces],
  )
  const multi = spaces.length > 1

  const exportPng = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `vrcam-${Date.now()}.png`
    a.click()
  }

  return (
    <>
      {/*
        Sits on its own dark plate rather than floating white text: the Daylight
        preset renders a pale sky background, and light-on-light made this
        invisible in exactly the preset a decorator opens with.
      */}
      <div className="pointer-events-none absolute left-5 top-5 z-30 rounded-xl border border-white/10 bg-black/55 px-4 py-2.5 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
          {multi ? `${activeName} · ` : ''}
          {venue.mode === 'indoor' ? 'Indoor' : 'Outdoor'} ·{' '}
          {toFeet(venueWidth(venue)).toFixed(0)} × {toFeet(venueDepth(venue)).toFixed(0)} ft
          {venue.wings.length > 1 ? ` · ${venue.wings.length} areas` : ''}
        </p>
        {eventTotal > 0 && (
          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-white">
            {inr(eventTotal)}
          </p>
        )}
        {multi && total > 0 && (
          <p className="mt-0.5 text-[11px] text-white/55">
            whole event · {inr(total)} for this space
          </p>
        )}
        {eventTotal > 0 && !calibrated && (
          <p className="mt-0.5 text-[10px] text-amber-300/90">
            indicative — venue not measured
          </p>
        )}
      </div>

      {/* Walking the client through each space is the pitch; make it one tap. */}
      {multi && (
        <div className="absolute right-5 top-5 z-30 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/55 p-1.5 backdrop-blur">
          {spaces.map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => setActiveSpace(sp.id)}
              className={`rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                sp.id === activeSpaceId
                  ? 'bg-[#e8b04b] text-[#171b22]'
                  : 'text-white/70 hover:bg-white/10'
              }`}
            >
              {sp.name}
            </button>
          ))}
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-2 py-1.5 backdrop-blur">
        {PRESETS.map((p) => (
          <Button key={p} active={lighting === p} onClick={() => setLighting(p)}>
            {LIGHTING[p].label}
          </Button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/15" />
        <Button
          active={cameraMode === 'walk'}
          onClick={() => setCameraMode(cameraMode === 'walk' ? 'orbit' : 'walk')}
        >
          🚶 Walk in
        </Button>
        <Button onClick={exportPng}>⬇ PNG</Button>
        <Button onClick={() => setPresenting(false)}>Exit</Button>
      </div>
    </>
  )
}
