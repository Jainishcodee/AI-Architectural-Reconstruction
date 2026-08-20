import { useEffect, useRef } from 'react'
import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useActiveSpace, useScene } from '../store/sceneStore'

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

  useEffect(() => {
    camera.position.y = EYE_HEIGHT
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

    // Soft-clamp inside the room rather than colliding: walking through a wall
    // is disorienting, but a hard stop on invisible geometry is worse.
    const pad = 0.35
    const hw = venue.width / 2 - pad
    const hd = venue.depth / 2 - pad
    if (venue.mode === 'indoor') {
      camera.position.x = Math.max(-hw, Math.min(hw, camera.position.x))
      camera.position.z = Math.max(-hd, Math.min(hd, camera.position.z))
    }
  })

  // The real exit path: whatever released the pointer — Escape, alt-tab, the
  // browser revoking it — drops us back to orbit, so the user can never end up
  // stranded in a walk mode that no longer responds to the mouse.
  return <PointerLockControls makeDefault onUnlock={() => setCameraMode('orbit')} />
}
