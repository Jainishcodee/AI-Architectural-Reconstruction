import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useStore, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Fog, Color, Vector3 } from 'three'
import { VenueShell } from './VenueShell'
import { DecorLayer } from './DecorLayer'
import { WalkControls } from './WalkControls'
import { LIGHTING } from './lighting'
import { activeSpace, useActiveSpace, useScene } from '../store/sceneStore'

function Rig() {
  const lighting = useActiveSpace((s) => s.lighting)
  const venue = useActiveSpace((s) => s.venue)
  const preset = LIGHTING[lighting]
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new Color(preset.background)
    scene.fog = new Fog(preset.fog, 30, 140)
  }, [scene, preset.background, preset.fog])

  const span = Math.max(venue.width, venue.depth)

  return (
    <>
      <ambientLight intensity={preset.ambient} color={preset.ambientColor} />
      <directionalLight
        position={[span * 0.8, venue.height * 3, span * 0.6]}
        intensity={preset.keyIntensity}
        color={preset.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-bias={-0.0005}
      />
      {/* Warm practicals so evening/night read as lit rather than merely dark. */}
      {preset.practicals && (
        <>
          <pointLight
            position={[0, venue.height * 0.8, -venue.depth * 0.25]}
            intensity={venue.width * 2.2}
            color="#ffb765"
            distance={span * 1.6}
            decay={2}
          />
          <pointLight
            position={[-venue.width * 0.3, venue.height * 0.7, venue.depth * 0.3]}
            intensity={venue.width * 1.1}
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
    const span = Math.max(venue.width, venue.depth)
    camera.position.set(span * 0.9, venue.height * 1.5, span * 1.25)
    controls.target.set(0, venue.height * 0.35, 0)
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
