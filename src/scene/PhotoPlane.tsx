import { useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { Color, DoubleSide, FrontSide, Matrix3, ShaderMaterial, Vector2 } from 'three'
import { useFrame } from '@react-three/fiber'
import { wallUvToPhotoUv } from '../lib/homography'
import type { PhotoAsset, PhotoPin, Vec3 } from '../types'

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
  uniform vec2 uUvOffset;
  uniform vec2 uUvScale;
  varying vec2 vUv;

  void main() {
    vec3 base = uSurface;

    if (uHasMap > 0.5) {
      // A wall broken by a doorway is drawn as several panels, but the photo
      // pinned to it spans the whole wall — so map this panel's UV back into
      // the wall's before applying the homography.
      vec2 wallUv = uUvOffset + vUv * uUvScale;
      vec3 p = uH * vec3(wallUv, 1.0);
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

export interface UvRect {
  x: number
  y: number
  w: number
  h: number
}

const FULL_UV: UvRect = { x: 0, y: 0, w: 1, h: 1 }

interface Props {
  position: Vec3
  rotation: Vec3
  width: number
  height: number
  /** This panel's slice of its wall, for photos that span several panels. */
  uv?: UvRect
  pin?: PhotoPin
  photo?: PhotoAsset
  tint: string
  surfaceColor: string
  /** Floors are seen from above only; a transom panel can be seen from behind. */
  doubleSided?: boolean
}

function WarpedSurface({ pin, photo, tint, surfaceColor, uv = FULL_UV, doubleSided }: Props) {
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
      uUvOffset: { value: new Vector2(uv.x, uv.y) },
      uUvScale: { value: new Vector2(uv.w, uv.h) },
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
    m.uniforms.uUvOffset.value.set(uv.x, uv.y)
    m.uniforms.uUvScale.value.set(uv.w, uv.h)
  })

  // Front-face only by default, with every surface's normal pointing into the
  // room: the walls between the camera and the scene cull themselves, so an
  // orbiting user always sees inside instead of the outside of a closed box.
  return (
    <shaderMaterial
      ref={matRef}
      attach="material"
      vertexShader={VERT}
      fragmentShader={FRAG}
      uniforms={uniforms}
      side={doubleSided ? DoubleSide : FrontSide}
    />
  )
}

export function PhotoPlane(props: Props) {
  const { position, rotation, width, height, pin, photo, surfaceColor, doubleSided } = props
  const hasPhoto = Boolean(pin && photo && pin.visible)

  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[width, height]} />
      {hasPhoto ? (
        <WarpedSurface {...props} />
      ) : (
        <meshStandardMaterial
          color={surfaceColor}
          side={doubleSided ? DoubleSide : FrontSide}
          roughness={0.95}
          metalness={0}
        />
      )}
    </mesh>
  )
}
