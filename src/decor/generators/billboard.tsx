import { useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Euler, Quaternion, Vector3, type Group } from 'three'
import { useScene } from '../../store/sceneStore'
import type { GeneratorProps } from '../registry'

const worldPos = new Vector3()
const worldQuat = new Quaternion()
const worldEuler = new Euler()

/** Yaw the parent already applies, so the billboard can cancel it out. */
function parentYaw(g: Group): number {
  if (!g.parent) return 0
  g.parent.getWorldQuaternion(worldQuat)
  worldEuler.setFromQuaternion(worldQuat, 'YXZ')
  return worldEuler.y
}

/**
 * A background-removed photo standing in the scene as a flat cutout.
 *
 * This is the long-tail escape hatch. Generating a real mesh costs money and
 * seconds per prop; a cutout is instant, free and offline, and at the viewing
 * angles a client actually looks at a stage from, it reads convincingly. Image
 * to 3D is the upgrade path, not the starting point.
 */
export function Billboard({ params }: GeneratorProps) {
  const photoId = String(params.photoId)
  const photo = useScene((s) => s.photos.find((p) => p.id === photoId))
  const height = Number(params.height)

  if (!photo) return null
  return (
    <BillboardMesh
      src={photo.src}
      aspect={photo.width / photo.height}
      height={height}
      faceCamera={params.facing === 'camera'}
    />
  )
}

function BillboardMesh({
  src,
  aspect,
  height,
  faceCamera,
}: {
  src: string
  aspect: number
  height: number
  faceCamera: boolean
}) {
  const tex = useTexture(src)
  const ref = useRef<Group>(null)
  const width = height * aspect

  // Yaw-only tracking: a full lookAt would tilt the cutout off the floor when
  // the camera drops to eye height, which instantly breaks the illusion.
  useFrame(({ camera }) => {
    const g = ref.current
    if (!g || !faceCamera) return
    g.getWorldPosition(worldPos)
    g.rotation.y =
      Math.atan2(camera.position.x - worldPos.x, camera.position.z - worldPos.z) -
      parentYaw(g)
  })

  return (
    <group ref={ref} position={[0, height / 2, 0]}>
      <mesh castShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={tex}
          transparent
          alphaTest={0.35}
          side={DoubleSide}
          roughness={0.9}
        />
      </mesh>
    </group>
  )
}
