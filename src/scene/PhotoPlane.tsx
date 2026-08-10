import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { Color, FrontSide, Matrix3, ShaderMaterial } from 'three'
import { useFrame } from '@react-three/fiber'
import { wallUvToPhotoUv } from '../lib/homography'
import type { SurfaceFrame } from '../lib/surfaces'
import type { PhotoAsset, PhotoPin } from '../types'

/**
 * The photo is warped on the GPU rather than resampled on the CPU: the wall's
 * own UV is pushed through the homography in the fragment shader, so dragging a
 * corner handle re-rectifies the image at frame rate with no per-pixel JS work
 * and true perspective (a triangle-split canvas warp would only be affine and
 * would crease down the diagonal).
 */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform mat3 uH;
  uniform float uOpacity;
  uniform vec3 uSurface;
  uniform vec3 uTint;
  uniform float uHasMap;
  varying vec2 vUv;

  void main() {
    vec3 base = uSurface;

    if (uHasMap > 0.5) {
      vec3 p = uH * vec3(vUv, 1.0);
      // Behind the camera plane of the original shot — nothing valid to sample.
      if (p.z > 0.0) {
        vec2 uv = p.xy / p.z;
        if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
          base = mix(uSurface, texture2D(uMap, uv).rgb, uOpacity);
        }
      }
    }

    gl_FragColor = vec4(base * uTint, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

interface Props {
  frame: SurfaceFrame
  pin?: PhotoPin
  photo?: PhotoAsset
  tint: string
  surfaceColor: string
  onPointerDown?: (e: never) => void
}

function WarpedSurface({ pin, photo, tint, surfaceColor }: Props) {
  const texture = useTexture(photo!.src)
  const matRef = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uH: { value: new Matrix3() },
      uOpacity: { value: 1 },
      uSurface: { value: new Color(surfaceColor) },
      uTint: { value: new Color(tint) },
      uHasMap: { value: 1 },
    }),
    // Built once; every frame-varying value is written in useFrame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texture],
  )

  useFrame(() => {
    const m = matRef.current
    if (!m) return
    const h = pin ? wallUvToPhotoUv(pin.corners) : null
    // A degenerate quad (mid-drag, inside-out) keeps the last good matrix
    // instead of flashing black.
    if (h) m.uniforms.uH.value.copy(h)
    m.uniforms.uOpacity.value = pin?.visible === false ? 0 : (pin?.opacity ?? 1)
    m.uniforms.uSurface.value.set(surfaceColor)
    m.uniforms.uTint.value.set(tint)
    m.uniforms.uMap.value = texture
  })

  // Front-face only, with every surface's normal pointing into the room: the
  // walls between the camera and the scene cull themselves, so an orbiting user
  // always sees inside instead of staring at the outside of a closed box.
  return (
    <shaderMaterial
      ref={matRef}
      attach="material"
      vertexShader={VERT}
      fragmentShader={FRAG}
      uniforms={uniforms}
      side={FrontSide}
    />
  )
}

export function PhotoPlane(props: Props) {
  const { frame, pin, photo } = props
  const hasPhoto = Boolean(pin && photo && pin.visible)

  return (
    <mesh
      position={frame.position}
      rotation={frame.rotation}
      receiveShadow
      userData={{ surface: frame.id }}
    >
      <planeGeometry args={[frame.width, frame.height]} />
      {hasPhoto ? (
        <WarpedSurface {...props} />
      ) : (
        <meshStandardMaterial
          color={props.surfaceColor}
          side={FrontSide}
          roughness={0.95}
          metalness={0}
        />
      )}
    </mesh>
  )
}
