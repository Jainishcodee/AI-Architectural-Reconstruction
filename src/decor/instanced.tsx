import { useLayoutEffect, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Vec3 } from '../types'

export interface Placement {
  p: Vec3
  s?: number
  /** Non-uniform scale, for squashed balloons and petals. */
  sv?: Vec3
  rot?: Vec3
  c?: string
}

const scratch = new Object3D()
const scratchColor = new Color()

interface Props {
  items: Placement[]
  color: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  /** Sphere detail. Balloons need more than berries. */
  detail?: [number, number]
  radius?: number
  opacity?: number
}

/**
 * One draw call for a whole balloon garland. A 240-balloon arch as individual
 * meshes would cost 240 draw calls per frame and make the editor unusable on the
 * mid-range laptops this audience actually owns.
 */
export function InstancedBalls({
  items,
  color,
  roughness = 0.28,
  metalness = 0.05,
  emissive,
  emissiveIntensity = 0,
  detail = [14, 10],
  radius = 1,
  opacity = 1,
}: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((it, i) => {
      scratch.position.set(it.p[0], it.p[1], it.p[2])
      if (it.sv) scratch.scale.set(it.sv[0], it.sv[1], it.sv[2])
      else scratch.scale.setScalar(it.s ?? 1)
      scratch.rotation.set(it.rot?.[0] ?? 0, it.rot?.[1] ?? 0, it.rot?.[2] ?? 0)
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
      mesh.setColorAt(i, scratchColor.set(it.c ?? color))
    })
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, color])

  return (
    <instancedMesh
      // instancedMesh cannot grow its buffers, so remount when the count changes.
      key={items.length}
      ref={ref}
      args={[undefined, undefined, Math.max(items.length, 1)]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <sphereGeometry args={[radius, detail[0], detail[1]]} />
      {/*
        White base colour is required, not cosmetic: three multiplies the
        material colour by each instance colour, so tinting both would square
        the value and turn mid-green foliage nearly black.
      */}
      <meshStandardMaterial
        color="#ffffff"
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  )
}

/**
 * Deterministic pseudo-random in [0,1).
 *
 * Every generator must be a pure function of its params: the scene is
 * serialised, undone and redone constantly, and Math.random() would make a
 * garland reshuffle itself on every one of those, which reads as a bug.
 */
export function rnd(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453
  return x - Math.floor(x)
}

/** Symmetric jitter in [-a, a]. */
export const jitter = (i: number, salt: number, a: number) =>
  (rnd(i, salt) * 2 - 1) * a

/**
 * Point on a circular-ish arch of the given span and rise, t in [0,1].
 * Used by arches, garlands and drapes so they all hang on the same curve.
 */
export function archPoint(t: number, span: number, rise: number): Vec3 {
  const x = (t - 0.5) * span
  const y = Math.sin(Math.PI * t) * rise
  return [x, y, 0]
}

/** Catenary sag between two ends, t in [0,1]. */
export function swagPoint(t: number, span: number, sag: number): Vec3 {
  const x = (t - 0.5) * span
  const y = -Math.sin(Math.PI * t) * sag
  return [x, y, 0]
}

export const palette = {
  blush: ['#f6d7d9', '#eeb0b8', '#d98b98', '#fbeaec'],
  gold: ['#e8c26b', '#d4a63f', '#f2dfa8', '#c9a24a'],
  marigold: ['#f5a623', '#e8811c', '#ffc852', '#d96a12'],
  pastel: ['#f7d9e3', '#d9e6f7', '#e6f7d9', '#f7f0d9'],
  royal: ['#7b2d5e', '#a8437f', '#3d1f4d', '#c76aa5'],
  white: ['#ffffff', '#f4f2ee', '#e8e4dc', '#fdfbf7'],
}

export type PaletteName = keyof typeof palette
