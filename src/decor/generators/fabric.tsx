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

/**
 * Tent liner: fabric radiating from a gathered point at the ceiling, out and
 * down to a hem above head height.
 *
 * The panels must lean. Hanging them vertically in a ring builds a closed
 * cylinder of curtain that walls the room off from itself — the decor ends up
 * hiding the very scene it is decorating.
 */
export function CeilingSwoop({ params }: GeneratorProps) {
  const radius = Number(params.radius)
  const height = Number(params.height)
  const panels = Math.round(Number(params.panels))

  // Hem stays well above eye level so sightlines across the room survive.
  const hem = height * 0.72
  const rise = Math.max(0.1, height - hem)
  const len = Math.hypot(radius, rise)
  const width = Math.max(0.5, (2 * Math.PI * radius) / panels)
  const lean = Math.atan2(radius, rise)

  const geo = useDrapeGeometry(width, len, 3, 0.09)

  return (
    <group>
      {Array.from({ length: panels }, (_, i) => {
        const ang = (i / panels) * Math.PI * 2
        return (
          <group key={i} rotation={[0, -ang, 0]}>
            <mesh
              geometry={geo}
              position={[radius / 2, (height + hem) / 2, 0]}
              rotation={[0, 0, lean]}
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
          </group>
        )
      })}
      {/* Gathered boss where every panel meets at the centre. */}
      <mesh position={[0, height - 0.04, 0]} castShadow>
        <sphereGeometry args={[Math.min(0.3, radius * 0.1), 16, 12]} />
        <meshStandardMaterial color={String(params.color)} roughness={0.6} />
      </mesh>
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
