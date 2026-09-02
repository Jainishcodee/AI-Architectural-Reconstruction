import { useEffect, useRef } from 'react'
import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useActiveSpace, useScene } from '../store/sceneStore'
import { pointInVenue } from '../lib/wings'

const EYE_HEIGHT = 1.6
const SPEED = 3.2
const SPRINT = 2.1

/**
 * First-person walkthrough.
 *
 * Eye height is the whole point: decor that looks balanced from an orbiting
 * bird's-eye view routinely reads as too high or too sparse from where guests
 * actually stand, and this is the cheapest way to catch that before install.
 */
export function WalkControls() {
  const venue = useActiveSpace((s) => s.venue)
  const setCameraMode = useScene((s) => s.setCameraMode)
  const camera = useThree((s) => s.camera)
  const keys = useRef<Record<string, boolean>>({})
  const dir = useRef(new Vector3())
  const fwd = useRef(new Vector3())
  const right = useRef(new Vector3())
  /** Last position known to be inside the venue, for wall sliding. */
  const before = useRef(new Vector3())

  useEffect(() => {
    camera.position.y = EYE_HEIGHT
    before.current.copy(camera.position)
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      // Kept as a fallback for the un-locked case only. Escape is NOT delivered
      // here when it is the gesture exiting pointer lock — the browser swallows
      // it — so `onUnlock` below is what actually ends walk mode.
      if (e.code === 'Escape') setCameraMode('orbit')
    }
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false)
    // A key held as the window loses focus never gets its keyup, which would
    // leave the walker sliding forever on return.
    const clear = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      keys.current = {}
      // three's PointerLockControls.disconnect() only drops its listeners, it
      // never releases the lock. Leaving walk mode by any route other than
      // Escape — the toolbar toggle, Present, a space switch — would otherwise
      // strand the user in orbit mode with the cursor still captured.
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [camera, setCameraMode])

  useFrame((_, delta) => {
    const k = keys.current
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
    const r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
    if (f === 0 && r === 0) return

    camera.getWorldDirection(fwd.current)
    fwd.current.y = 0
    fwd.current.normalize()
    right.current.crossVectors(fwd.current, camera.up).normalize()

    dir.current
      .set(0, 0, 0)
      .addScaledVector(fwd.current, f)
      .addScaledVector(right.current, r)
      .normalize()
      .multiplyScalar(SPEED * (k.ShiftLeft ? SPRINT : 1) * delta)

    camera.position.add(dir.current)
    camera.position.y = EYE_HEIGHT

    /*
      Keep the walker on some wing's floor. With several wings this cannot be a
      box clamp any more — the point has to be tested against each footprint, so
      walking through the opening from a foyer into the hall is allowed while
      stepping out into the void is not. On refusal the move is simply undone,
      which slides the user along a wall instead of stopping them dead.
    */
    if (venue.mode === 'indoor' && !pointInVenue(venue, camera.position.x, camera.position.z, 0.35)) {
      const slideX = pointInVenue(venue, camera.position.x, before.current.z, 0.35)
      const slideZ = pointInVenue(venue, before.current.x, camera.position.z, 0.35)
      if (slideX) camera.position.z = before.current.z
      else if (slideZ) camera.position.x = before.current.x
      else camera.position.copy(before.current)
    }
    before.current.copy(camera.position)
  })

  // The real exit path: whatever released the pointer — Escape, alt-tab, the
  // browser revoking it — drops us back to orbit, so the user can never end up
  // stranded in a walk mode that no longer responds to the mouse.
  return <PointerLockControls makeDefault onUnlock={() => setCameraMode('orbit')} />
}
