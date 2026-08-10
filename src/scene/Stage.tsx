import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Fog, Color } from 'three'
import { VenueShell } from './VenueShell'
import { DecorLayer } from './DecorLayer'
import { WalkControls } from './WalkControls'
import { LIGHTING } from './lighting'
import { useScene } from '../store/sceneStore'

function Rig() {
  const lighting = useScene((s) => s.lighting)
  const venue = useScene((s) => s.venue)
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

/** Keeps the orbit camera framed on the room as it is resized or calibrated. */
function AutoFrame() {
  const venue = useScene((s) => s.venue)
  const controls = useThree((s) => s.controls) as
    | { target: { set: (x: number, y: number, z: number) => void }; update: () => void }
    | null
  const framed = useRef(false)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    if (framed.current || !controls) return
    framed.current = true
    const span = Math.max(venue.width, venue.depth)
    camera.position.set(span * 0.9, venue.height * 1.5, span * 1.25)
    controls.target.set(0, venue.height * 0.35, 0)
    controls.update()
  }, [controls, camera, venue.width, venue.depth, venue.height])

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
  if (cameraMode === 'walk') return <WalkControls />
  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={1.5}
        maxDistance={120}
      />
      <AutoFrame />
    </>
  )
}
