import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Plane as MathPlane, Vector3 } from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { PhotoPlane } from './PhotoPlane'
import { boundsOf, slabs, wallPanels, type WallPanel } from '../lib/wings'
import { useActiveSpace, useScene } from '../store/sceneStore'
import { LIGHTING } from './lighting'
import type { PhotoPin, SurfaceId, Venue, Wing } from '../types'

const MIN_DIM = 1.5
const MAX_DIM = 80

type Axis = 'x' | 'y' | 'z'

/**
 * A draggable nub on a wing's edge. Drag maths is done by intersecting the
 * pointer ray with the plane the handle is constrained to, which keeps the
 * handle under the cursor at any camera angle — the thing that makes resizing
 * feel like moving a physical piece rather than nudging a number field.
 */
function DragHandle({
  position,
  axis,
  onDrag,
}: {
  position: [number, number, number]
  axis: Axis
  onDrag: (value: number) => void
}) {
  const [active, setActive] = useState(false)
  const [hover, setHover] = useState(false)
  const planeRef = useRef(new MathPlane())
  const hit = useRef(new Vector3())
  // OrbitControls binds to the canvas DOM element, so R3F's stopPropagation —
  // which only walks the 3D scene graph — cannot keep a handle drag from also
  // spinning the camera. The controls have to be switched off explicitly.
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null

  const begin = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      if (controls) controls.enabled = false
      // Constrain to a plane containing the handle, normal to a *different*
      // axis, so the ray always has a well-conditioned intersection.
      const normal = axis === 'y' ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
      planeRef.current.setFromNormalAndCoplanarPoint(normal, new Vector3(...position))
      setActive(true)
    },
    [axis, position, controls],
  )

  const move = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active) return
      e.stopPropagation()
      if (!e.ray.intersectPlane(planeRef.current, hit.current)) return
      onDrag(axis === 'x' ? hit.current.x : axis === 'y' ? hit.current.y : hit.current.z)
    },
    [active, axis, onDrag],
  )

  // A pointerup outside the handle would otherwise leave the camera frozen.
  useEffect(() => {
    if (!active) return
    const release = () => {
      if (controls) controls.enabled = true
      setActive(false)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [active, controls])

  return (
    <mesh
      position={position}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshBasicMaterial
        color={active ? '#ffd479' : hover ? '#e8b04b' : '#7c8798'}
        depthTest={false}
        transparent
        opacity={0.95}
      />
    </mesh>
  )
}

/**
 * Resize nubs for one wing.
 *
 * Each nub moves a single face rather than scaling about the centre, so pushing
 * a wall outward leaves the opposite wall — and anything abutting it — exactly
 * where it was. Resizing about the centre would silently tear a wing away from
 * the neighbour it shares a doorway with.
 */
function WingHandles({ wing, selected }: { wing: Wing; selected: boolean }) {
  const updateWing = useScene((s) => s.updateWing)
  const b = boundsOf(wing)
  const clamp = (v: number) => Math.min(MAX_DIM, Math.max(MIN_DIM, v))

  const moveFace = (face: 'xMin' | 'xMax' | 'zMin' | 'zMax', value: number) => {
    if (face === 'xMax') {
      const width = clamp(value - b.xMin)
      updateWing(wing.id, { width, x: b.xMin + width / 2 })
    } else if (face === 'xMin') {
      const width = clamp(b.xMax - value)
      updateWing(wing.id, { width, x: b.xMax - width / 2 })
    } else if (face === 'zMax') {
      const depth = clamp(value - b.zMin)
      updateWing(wing.id, { depth, z: b.zMin + depth / 2 })
    } else {
      const depth = clamp(b.zMax - value)
      updateWing(wing.id, { depth, z: b.zMax - depth / 2 })
    }
  }

  return (
    <group>
      <DragHandle
        position={[b.xMax, 0.25, wing.z]}
        axis="x"
        onDrag={(v) => moveFace('xMax', v)}
      />
      <DragHandle
        position={[b.xMin, 0.25, wing.z]}
        axis="x"
        onDrag={(v) => moveFace('xMin', v)}
      />
      <DragHandle
        position={[wing.x, 0.25, b.zMax]}
        axis="z"
        onDrag={(v) => moveFace('zMax', v)}
      />
      <DragHandle
        position={[wing.x, 0.25, b.zMin]}
        axis="z"
        onDrag={(v) => moveFace('zMin', v)}
      />
      {selected && (
        <DragHandle
          position={[b.xMax, wing.height, b.zMin]}
          axis="y"
          onDrag={(v) => updateWing(wing.id, { height: clamp(v) })}
        />
      )}
    </group>
  )
}

export function VenueShell() {
  const venue = useActiveSpace((s) => s.venue)
  const pins = useActiveSpace((s) => s.pins)
  const photos = useScene((s) => s.photos)
  const lighting = useActiveSpace((s) => s.lighting)
  const cameraMode = useScene((s) => s.cameraMode)
  const presenting = useScene((s) => s.presenting)
  const activeWingId = useScene((s) => s.activeWingId)

  const preset = LIGHTING[lighting]
  const showHandles = cameraMode === 'orbit' && !presenting
  const firstWingId = venue.wings[0]?.id

  /** A pin with no wing id predates wings and belongs to the original room. */
  const pinFor = (wingId: string, side: SurfaceId): PhotoPin | undefined =>
    pins.find((p) => p.surface === side && (p.wingId ?? firstWingId) === wingId)

  const photoFor = (pin?: PhotoPin) =>
    pin ? photos.find((p) => p.id === pin.photoId) : undefined

  const panels = venue.mode === 'indoor' ? wallPanels(venue) : outdoorBackdrop(venue)

  return (
    <group>
      {slabs(venue).map((slab) => {
        const pin = pinFor(slab.wingId, slab.kind)
        return (
          <Suspense key={slab.key} fallback={null}>
            <PhotoPlane
              position={slab.position}
              rotation={slab.rotation}
              width={slab.width}
              height={slab.height}
              pin={pin}
              photo={photoFor(pin)}
              tint={preset.tint}
              surfaceColor={slab.kind === 'floor' ? preset.floor : preset.wall}
            />
          </Suspense>
        )
      })}

      {panels.map((panel) => {
        const pin = pinFor(panel.wingId, panel.side)
        return (
          <Suspense key={panel.key} fallback={null}>
            <PhotoPlane
              position={panel.position}
              rotation={panel.rotation}
              width={panel.width}
              height={panel.height}
              uv={panel.uv}
              pin={pin}
              photo={photoFor(pin)}
              tint={preset.tint}
              surfaceColor={preset.wall}
              // A transom over a doorway is visible from the far wing too.
              doubleSided={panel.uv.y > 0}
            />
          </Suspense>
        )
      })}

      {showHandles &&
        venue.wings.map((wing) => (
          <WingHandles
            key={wing.id}
            wing={wing}
            selected={venue.wings.length === 1 || wing.id === activeWingId}
          />
        ))}
    </group>
  )
}

/**
 * Outdoor venues get one backdrop wall behind the first wing and nothing else —
 * a lawn has a facade or a boundary behind the stage, not four walls. Extra
 * wings still contribute their ground area, so an L-shaped lawn works.
 */
function outdoorBackdrop(venue: Venue): WallPanel[] {
  const first = venue.wings[0]
  if (!first) return []
  return wallPanels({ mode: 'indoor', wings: [first] }).filter((p) => p.side === 'north')
}
