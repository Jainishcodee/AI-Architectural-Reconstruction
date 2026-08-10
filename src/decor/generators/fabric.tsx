import { useMemo } from 'react'
import { DoubleSide, PlaneGeometry } from 'three'
import type { GeneratorProps } from '../registry'

/**
 * Drape panel with vertical folds.
 *
 * The folds are baked into the geometry as a sine displacement rather than
 * simulated: cloth sim is wildly out of proportion to the need here, and a
 * static sine reads correctly the moment there is a light grazing across it.
 */
function useDrapeGeometry(width: number, height: number, folds: number, depth: number) {
  return useMemo(() => {
    const segX = Math.max(24, Math.round(folds * 6))
    const geo = new PlaneGeometry(width, height, segX, 12)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const u = x / width + 0.5
      // Folds pinch at the top where the fabric is gathered, and open at the hem.
      const openness = 0.35 + 0.65 * (0.5 - y / height)
      pos.setZ(i, Math.sin(u * Math.PI * 2 * folds) * depth * openness)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [width, height, folds, depth])
}

export function DrapePanel({ params }: GeneratorProps) {
  const width = Number(params.width)
  const height = Number(params.height)
  const folds = Number(params.folds)
  const geo = useDrapeGeometry(width, height, folds, 0.13)

  return (
    <mesh position={[0, height / 2, 0]} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        color={String(params.color)}
        roughness={0.72}
        metalness={0.08}
        side={DoubleSide}
      />
    </mesh>
  )
}

export function drapeBom(params: Record<string, number | string>) {
  const width = Number(params.width)
  const height = Number(params.height)
  const folds = Number(params.folds)
  // Gathered fabric needs roughly 2x the flat width in cloth.
  const runningFt = width * 3.28 * 2
  return [
    { label: 'Drape fabric', qty: Math.ceil(runningFt * (height * 3.28) * 0.35), unit: 'sq ft', rate: 18 },
    { label: 'Drape panel (stitched)', qty: Math.max(1, Math.round(folds / 4)), unit: 'pcs', rate: 450 },
  ]
}

/** Ceiling-to-floor tent liner: several drapes swept around a centre point. */
export function CeilingSwoop({ params }: GeneratorProps) {
  const radius = Number(params.radius)
  const height = Number(params.height)
  const panels = Math.round(Number(params.panels))
  const geo = useDrapeGeometry(Math.max(0.6, (2 * Math.PI * radius) / panels), height, 3, 0.1)

  return (
    <group>
      {Array.from({ length: panels }, (_, i) => {
        const ang = (i / panels) * Math.PI * 2
        return (
          <mesh
            key={i}
            geometry={geo}
            position={[Math.cos(ang) * radius, height / 2, Math.sin(ang) * radius]}
            rotation={[0, -ang + Math.PI / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={String(params.color)}
              roughness={0.7}
              side={DoubleSide}
              transparent
              opacity={0.93}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function ceilingSwoopBom(params: Record<string, number | string>) {
  const panels = Math.round(Number(params.panels))
  const height = Number(params.height)
  return [
    { label: 'Ceiling drape panel', qty: panels, unit: 'pcs', rate: 520 },
    { label: 'Rigging + hooks', qty: panels, unit: 'set', rate: 60 },
    { label: 'Ladder / rigging labour', qty: Math.ceil((panels * height) / 12), unit: 'hr', rate: 250 },
  ]
}
