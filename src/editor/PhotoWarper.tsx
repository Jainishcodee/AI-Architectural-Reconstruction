import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useScene } from '../store/sceneStore'
import { cloneQuad, FULL_FRAME, isQuadValid } from '../lib/homography'
import { estimateSurfaceQuad, type EstimatorResult } from '../geometry/estimator'
import { SURFACE_LABELS, type Vec2 } from '../types'
import { Button, Hint } from './ui'

const HANDLE_LABELS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']

/**
 * Drag the four corners of the surface as it appears in the photo. The wall in
 * the 3D view re-rectifies live, so the user is aiming at a result they can see
 * rather than guessing at an abstract transform.
 */
export function PhotoWarper() {
  const editingPinId = useScene((s) => s.editingPinId)
  const pin = useScene((s) => s.pins.find((p) => p.id === editingPinId))
  const photo = useScene((s) => s.photos.find((p) => p.id === pin?.photoId))
  const updatePin = useScene((s) => s.updatePin)
  const setEditingPin = useScene((s) => s.setEditingPin)
  const logCorrection = useScene((s) => s.logCorrection)

  const boxRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [estimate, setEstimate] = useState<EstimatorResult>({ status: 'idle' })

  // Correction-flywheel bookkeeping: what was proposed, and how long the user
  // spent fixing it. Logged locally now; it is the training set later.
  const openedAt = useRef(Date.now())
  const proposed = useRef<[Vec2, Vec2, Vec2, Vec2] | null>(null)

  useEffect(() => {
    openedAt.current = Date.now()
    proposed.current = pin ? cloneQuad(pin.corners) : null
    setEstimate({ status: 'idle' })
  }, [editingPinId, pin])

  const corners = pin?.corners

  const setCorner = useCallback(
    (index: number, xy: Vec2) => {
      if (!pin) return
      const next = cloneQuad(pin.corners)
      next[index] = xy
      // Refuse inside-out quads: the homography would flip and the wall would
      // show a mirrored, unreadable smear.
      if (!isQuadValid(next)) return
      updatePin(pin.id, { corners: next, proposedBy: 'manual' })
    },
    [pin, updatePin],
  )

  const pointerToNorm = useCallback((e: PointerEvent | React.PointerEvent): Vec2 => {
    const box = boxRef.current!.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    ]
  }, [])

  useEffect(() => {
    if (dragging === null) return
    const move = (e: PointerEvent) => setCorner(dragging, pointerToNorm(e))
    const up = () => setDragging(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, setCorner, pointerToNorm])

  const polygon = useMemo(
    () => corners?.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(', '),
    [corners],
  )

  const close = () => {
    if (pin && proposed.current) {
      logCorrection({
        photoId: pin.photoId,
        surface: pin.surface,
        proposedBy: pin.proposedBy,
        proposed: proposed.current,
        final: cloneQuad(pin.corners),
        msSpentAdjusting: Date.now() - openedAt.current,
      })
    }
    setEditingPin(null)
  }

  const runEstimate = async () => {
    if (!photo || !pin) return
    setEstimate({ status: 'running' })
    const result = await estimateSurfaceQuad(photo.src, pin.surface)
    setEstimate(result)
    if (result.status === 'ok') {
      proposed.current = cloneQuad(result.corners)
      openedAt.current = Date.now()
      updatePin(pin.id, { corners: result.corners, proposedBy: 'vanishing-point' })
    }
  }

  if (!pin || !photo) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#2c333f] bg-[#171b22] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#262c36] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[#e7eaf0]">
              Align {SURFACE_LABELS[pin.surface].toLowerCase()}
            </h3>
            <p className="text-[11px] text-[#7c8798]">
              Drag each handle onto that corner of the {pin.surface === 'floor' ? 'floor' : 'wall'} in the photo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void runEstimate()} disabled={estimate.status === 'running'}>
              {estimate.status === 'running' ? 'Detecting…' : '✨ Auto-align'}
            </Button>
            <Button
              onClick={() => updatePin(pin.id, { corners: cloneQuad(FULL_FRAME), proposedBy: 'manual' })}
            >
              Reset
            </Button>
            <Button tone="primary" onClick={close}>
              Done
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <div
            ref={boxRef}
            className="relative mx-auto w-full max-w-3xl touch-none select-none"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          >
            <img
              src={photo.src}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full rounded-md object-fill"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[#e8b04b]/12"
              style={{ clipPath: `polygon(${polygon})` }}
            />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points={corners!.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                fill="none"
                stroke="#e8b04b"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {corners!.map(([x, y], i) => (
              <button
                key={i}
                type="button"
                title={HANDLE_LABELS[i]}
                onPointerDown={(e) => {
                  e.preventDefault()
                  setDragging(i)
                }}
                className={`absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 transition ${
                  dragging === i
                    ? 'scale-125 border-white bg-[#e8b04b]'
                    : 'border-[#171b22] bg-[#e8b04b] hover:scale-110'
                }`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              />
            ))}
          </div>

          {estimate.status === 'declined' && (
            <div className="mx-auto mt-3 max-w-3xl">
              <Hint tone="warn">
                Auto-align couldn&apos;t find a reliable wall here — {estimate.reason} Drag the
                corners by hand instead.
              </Hint>
            </div>
          )}
          {estimate.status === 'ok' && (
            <div className="mx-auto mt-3 max-w-3xl">
              <Hint>
                Auto-aligned from {estimate.lineCount} detected edges. Nudge any handle that
                looks off.
              </Hint>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
