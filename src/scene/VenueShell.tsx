import { Suspense, useCallback, useRef, useState } from 'react'
import { Plane as MathPlane, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { PhotoPlane } from './PhotoPlane'
import { surfaceFrame, surfacesFor } from '../lib/surfaces'
import { useScene } from '../store/sceneStore'
import { LIGHTING } from './lighting'

const MIN_DIM = 2
const MAX_DIM = 60

type Axis = 'x' | 'y' | 'z'

/**
 * A draggable nub on the room's edge. Drag maths is done by intersecting the
 * pointer ray with the plane the handle is constrained to, which keeps the
 * handle under the cursor at any camera angle — the thing that makes resizing
 * feel like moving a physical piece rather than nudging a number field.
 */
function DragHandle({
  position,
  axis,
  onDrag,
  onCommit,
}: {
  position: [number, number, number]
  axis: Axis
  onDrag: (value: number) => void
  onCommit: () => void
}) {
  const [active, setActive] = useState(false)
  const [hover, setHover] = useState(false)
  const planeRef = useRef(new MathPlane())
  const hit = useRef(new Vector3())

  const begin = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      // Constrain to a plane containing the handle, normal to a *different*
      // axis, so the ray always has a well-conditioned intersection.
      const normal =
        axis === 'y'
          ? new Vector3(0, 0, 1)
          : axis === 'x'
            ? new Vector3(0, 1, 0)
            : new Vector3(0, 1, 0)
      planeRef.current.setFromNormalAndCoplanarPoint(
        normal,
        new Vector3(...position),
      )
      setActive(true)
    },
    [axis, position],
  )

  const move = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active) return
      e.stopPropagation()
      if (!e.ray.intersectPlane(planeRef.current, hit.current)) return
      const v = axis === 'x' ? hit.current.x : axis === 'y' ? hit.current.y : hit.current.z
      onDrag(v)
    },
    [active, axis, onDrag],
  )

  const end = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!active) return
      e.stopPropagation()
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
      setActive(false)
      onCommit()
    },
    [active, onCommit],
  )

  return (
    <mesh
      position={position}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
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

export function VenueShell() {
  const venue = useScene((s) => s.venue)
  const pins = useScene((s) => s.pins)
  const photos = useScene((s) => s.photos)
  const lighting = useScene((s) => s.lighting)
  const cameraMode = useScene((s) => s.cameraMode)
  const setVenueSize = useScene((s) => s.setVenueSize)

  const preset = LIGHTING[lighting]
  const ids = surfacesFor(venue)
  const showHandles = cameraMode === 'orbit'

  const clamp = (v: number) => Math.min(MAX_DIM, Math.max(MIN_DIM, v))

  return (
    <group>
      {ids.map((id) => {
        const frame = surfaceFrame(id, venue)
        const pin = pins.find((p) => p.surface === id)
        const photo = pin ? photos.find((p) => p.id === pin.photoId) : undefined
        const surfaceColor = id === 'floor' ? preset.floor : preset.wall
        return (
          <Suspense key={id} fallback={null}>
            <PhotoPlane
              frame={frame}
              pin={pin}
              photo={photo}
              tint={preset.tint}
              surfaceColor={surfaceColor}
            />
          </Suspense>
        )
      })}

      {showHandles && (
        <group>
          <DragHandle
            position={[venue.width / 2, 0.25, 0]}
            axis="x"
            onDrag={(x) => setVenueSize({ width: clamp(Math.abs(x) * 2) })}
            onCommit={() => {}}
          />
          <DragHandle
            position={[0, 0.25, venue.depth / 2]}
            axis="z"
            onDrag={(z) => setVenueSize({ depth: clamp(Math.abs(z) * 2) })}
            onCommit={() => {}}
          />
          {venue.mode === 'indoor' && (
            <DragHandle
              position={[venue.width / 2, venue.height, -venue.depth / 2]}
              axis="y"
              onDrag={(y) => setVenueSize({ height: clamp(y) })}
              onCommit={() => {}}
            />
          )}
        </group>
      )}
    </group>
  )
}
