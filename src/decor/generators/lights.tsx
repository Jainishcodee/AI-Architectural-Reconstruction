import { useMemo } from 'react'
import { InstancedBalls, rnd, swagPoint, type Placement } from '../instanced'
import type { GeneratorProps } from '../registry'

/**
 * Fairy-light swags.
 *
 * The bulbs are emissive instanced spheres, not real lights: a 200-bulb string
 * of point lights would blow the WebGL light limit and tank the frame rate. Two
 * actual point lights per swag carry the spill; the rest is the glow read.
 */
export function FairyLights({ params }: GeneratorProps) {
  const span = Number(params.span)
  const sag = Number(params.sag)
  const strands = Math.round(Number(params.strands))
  const spacing = Number(params.spacing)
  const color = String(params.color)

  const bulbs = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    const perStrand = Math.max(4, Math.round(span / spacing))
    for (let s = 0; s < strands; s++) {
      const z = strands === 1 ? 0 : (s / (strands - 1) - 0.5) * (strands * 0.35)
      for (let i = 0; i <= perStrand; i++) {
        const t = i / perStrand
        const [x, y] = swagPoint(t, span, sag * (0.85 + rnd(s, 1) * 0.3))
        out.push({ p: [x, y, z], s: 0.028 })
      }
    }
    return out
  }, [span, sag, strands, spacing])

  return (
    <group>
      <InstancedBalls
        items={bulbs}
        color={color}
        emissive={color}
        emissiveIntensity={3.2}
        roughness={0.4}
        detail={[6, 5]}
      />
      <pointLight position={[-span * 0.25, -sag * 0.5, 0]} intensity={span * 0.8} color={color} distance={span * 1.2} decay={2} />
      <pointLight position={[span * 0.25, -sag * 0.5, 0]} intensity={span * 0.8} color={color} distance={span * 1.2} decay={2} />
    </group>
  )
}

export function fairyLightsBom(params: Record<string, number | string>) {
  const span = Number(params.span)
  const strands = Math.round(Number(params.strands))
  const ft = Math.ceil(span * 3.28 * 1.15 * strands)
  return [
    { label: 'Fairy light string', qty: ft, unit: 'ft', rate: 12 },
    { label: 'Extension + adaptor', qty: strands, unit: 'pcs', rate: 120 },
  ]
}

/** Uplighter wash against a wall — cheap, and transforms a plain hall. */
export function Uplighter({ params }: GeneratorProps) {
  const color = String(params.color)
  const intensity = Number(params.intensity)

  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.18, 12]} />
        <meshStandardMaterial color="#15171c" roughness={0.5} metalness={0.6} />
      </mesh>
      <spotLight
        position={[0, 0.2, 0]}
        target-position={[0, 6, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={intensity * 12}
        color={color}
        distance={14}
        decay={1.4}
      />
      <pointLight position={[0, 0.35, 0]} intensity={intensity * 1.5} color={color} distance={3} decay={2} />
    </group>
  )
}

export function uplighterBom() {
  return [{ label: 'LED uplighter', qty: 1, unit: 'pcs', rate: 300 }]
}
