import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useStore, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Fog, Color, Vector3 } from 'three'
import { VenueShell } from './VenueShell'
import { DecorLayer } from './DecorLayer'
import { WalkControls } from './WalkControls'
import { LIGHTING } from './lighting'
import { activeSpace, useActiveSpace, useScene } from '../store/sceneStore'
import { venueBounds, venueDepth, venueHeight, venueWidth } from '../lib/wings'

function Rig() {
  const lighting = useActiveSpace((s) => s.lighting)
  const venue = useActiveSpace((s) => s.venue)
  const preset = LIGHTING[lighting]
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new Color(preset.background)
    scene.fog = new Fog(preset.fog, 30, 140)
  }, [scene, preset.background, preset.fog])

  // Lights follow the venue's overall extent and centre, so an L-shaped room
  // whose bulk sits off the origin is still lit and still casts shadows.
  const b = venueBounds(venue)
  const cx = (b.xMin + b.xMax) / 2
  const cz = (b.zMin + b.zMax) / 2
  const height = venueHeight(venue)
  const span = Math.max(venueWidth(venue), venueDepth(venue))

  return (
    <>
      <ambientLight intensity={preset.ambient} color={preset.ambientColor} />
      <directionalLight
        position={[cx + span * 0.8, height * 3, cz + span * 0.6]}
        intensity={preset.keyIntensity}
        color={preset.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span * 1.2}
        shadow-camera-right={span * 1.2}
        shadow-camera-top={span * 1.2}
        shadow-camera-bottom={-span * 1.2}
        shadow-bias={-0.0005}
      />
      {/* Warm practicals so evening/night read as lit rather than merely dark. */}
      {preset.practicals && (
        <>
          <pointLight
            position={[cx, height * 0.8, cz - venueDepth(venue) * 0.25]}
            intensity={span * 2.2}
            color="#ffb765"
            distance={span * 1.6}
            decay={2}
          />
          <pointLight
            position={[cx - venueWidth(venue) * 0.3, height * 0.7, cz + venueDepth(venue) * 0.3]}
            intensity={span * 1.1}
            color="#ff9a5c"
            distance={span * 1.2}
            decay={2}
          />
        </>
      )}
    </>
  )
}

/**
 * Frames the orbit camera on the room.
 *
 * Refits on `epoch` — bumped only when a whole project is swapped in — rather
 * than on every venue change, so it never yanks the camera while the user is
 * mid-drag on a resize handle.
 */
function AutoFrame() {
  const epoch = useScene((s) => s.epoch)
  const controls = asOrbit(useThree((s) => s.controls))
  const camera = useThree((s) => s.camera)
  const framedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!controls || framedFor.current === epoch) return
    framedFor.current = epoch
    const { venue } = activeSpace()
    const b = venueBounds(venue)
    const cx = (b.xMin + b.xMax) / 2
    const cz = (b.zMin + b.zMax) / 2
    const h = venueHeight(venue)
    const span = Math.max(venueWidth(venue), venueDepth(venue))
    camera.position.set(cx + span * 0.9, h * 1.5, cz + span * 1.25)
    controls.target.set(cx, h * 0.35, cz)
    controls.update()
  }, [controls, camera, epoch])

  return null
}

export function Stage() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: ACESFilmicToneMapping }}
      camera={{ fov: 55, near: 0.1, far: 400, position: [11, 6, 15] }}
      onPointerMissed={() => useScene.getState().selectItem(null)}
    >
      <Suspense fallback={null}>
        <Rig />
        <VenueShell />
        <DecorLayer />
      </Suspense>
      <CameraControls />
    </Canvas>
  )
}

function CameraControls() {
  const cameraMode = useScene((s) => s.cameraMode)
  return (
    <>
      {cameraMode === 'walk' ? (
        <WalkControls />
      ) : (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={1.5}
          maxDistance={120}
        />
      )}
      {/*
        Both stay mounted across the mode switch. Nesting them under the orbit
        branch meant they remounted every time the user left walk mode, resetting
        the refs that remember what has already been framed — so the camera was
        re-framed on every exit, undoing the handover below.
      */}
      <AutoFrame />
      <OrbitHandover />
    </>
  )
}

interface OrbitLike {
  target: Vector3
  update: () => void
}

/**
 * R3F's default `controls` is whichever control set most recently claimed
 * `makeDefault`, and during a walk/orbit switch that is briefly the
 * PointerLockControls — which has no `target`. Reaching for `.target.set()`
 * there threw and unmounted the entire app.
 */
function asOrbit(controls: unknown): OrbitLike | null {
  return controls && typeof controls === 'object' && 'target' in controls
    ? (controls as OrbitLike)
    : null
}

const scratchDir = new Vector3()

/**
 * Hands the camera back from walk mode without a lurch.
 *
 * Leaving walk mode drops the user at eye height, often right against a wall,
 * while OrbitControls still pivots around the room centre from the last framing.
 * That violates both `minDistance` and `maxPolarAngle`, so the controls snap the
 * camera somewhere else on the first frame — which reads as the view breaking.
 * Re-pivoting on the spot the user was actually looking at keeps the transition
 * continuous.
 */
function OrbitHandover() {
  const cameraMode = useScene((s) => s.cameraMode)
  const camera = useThree((s) => s.camera)
  const store = useStore()
  const previous = useRef(cameraMode)

  useEffect(() => {
    const cameFromWalk = previous.current === 'walk'
    previous.current = cameraMode
    if (cameraMode !== 'orbit' || !cameFromWalk) return

    // OrbitControls mounts in this same commit; wait a frame for it to register
    // itself as the default before handing it a target.
    const id = requestAnimationFrame(() => {
      const controls = asOrbit(store.getState().controls)
      if (!controls) return
      camera.getWorldDirection(scratchDir)
      controls.target.copy(camera.position).addScaledVector(scratchDir, 6)
      // Drop the pivot below eye level so the polar angle stays inside its
      // clamp — orbiting a point dead level with the camera is exactly the
      // degenerate case that snaps.
      controls.target.y = Math.max(0.3, controls.target.y - 0.8)
      controls.update()
    })
    return () => cancelAnimationFrame(id)
  }, [cameraMode, camera, store])

  return null
}
