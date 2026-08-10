import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { InstancedBalls, rnd, type Placement } from '../instanced'
import type { GeneratorProps } from '../registry'

function Chair({ sash }: { sash: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
        <meshStandardMaterial color="#efe9dc" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, -0.19]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.56, 0.06]} />
        <meshStandardMaterial color="#efe9dc" roughness={0.8} />
      </mesh>
      {/* The sash is the whole point — it is what the client is paying for. */}
      <mesh position={[0, 0.72, -0.15]} castShadow>
        <boxGeometry args={[0.46, 0.16, 0.03]} />
        <meshStandardMaterial color={sash} roughness={0.55} metalness={0.12} />
      </mesh>
      {[
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.44, 8]} />
          <meshStandardMaterial color="#d9d2c4" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** A row or gentle arc of ceremony chairs. */
export function ChairRow({ params }: GeneratorProps) {
  const count = Math.round(Number(params.count))
  const spacing = Number(params.spacing)
  const curve = Number(params.curve)
  const sash = String(params.sash)

  const seats = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = []
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * spacing
      // `curve` bends the row into an arc so aisles feel designed, not gridded.
      const z = curve === 0 ? 0 : (x * x) / (2 * (100 / Math.max(curve, 0.001)))
      const ry = curve === 0 ? 0 : -Math.atan((x * curve) / 100)
      out.push({ x, z, ry })
    }
    return out
  }, [count, spacing, curve])

  return (
    <group>
      {seats.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.ry, 0]}>
          <Chair sash={sash} />
        </group>
      ))}
    </group>
  )
}

export function chairRowBom(params: Record<string, number | string>) {
  const count = Math.round(Number(params.count))
  return [
    { label: 'Banquet chair', qty: count, unit: 'pcs', rate: 45 },
    { label: 'Chair sash', qty: count, unit: 'pcs', rate: 25 },
  ]
}

/** Round guest table with cloth, runner and a floral centrepiece. */
export function RoundTable({ params }: GeneratorProps) {
  const diameter = Number(params.diameter)
  const seats = Math.round(Number(params.seats))
  const cloth = String(params.cloth)
  const height = 0.75
  const r = diameter / 2

  const centrepiece = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    for (let i = 0; i < 34; i++) {
      const ang = rnd(i, 1) * Math.PI * 2
      const rad = rnd(i, 2) * 0.2
      out.push({
        p: [Math.cos(ang) * rad, height + 0.16 + rnd(i, 3) * 0.16, Math.sin(ang) * rad],
        s: 0.05 * (0.8 + rnd(i, 4) * 0.5),
        c: ['#f3c9d4', '#ffffff', '#e8b04b'][i % 3],
      })
    }
    return out
  }, [])

  return (
    <group>
      <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <circleGeometry args={[r, 40]} />
        <meshStandardMaterial color={cloth} roughness={0.85} side={DoubleSide} />
      </mesh>
      {/* Skirt to the floor — a floating disc gives the whole render away. */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 1.03, height, 36, 1, true]} />
        <meshStandardMaterial color={cloth} roughness={0.88} side={DoubleSide} />
      </mesh>
      <mesh position={[0, height + 0.008, 0]} castShadow>
        <cylinderGeometry args={[r * 0.34, r * 0.34, 0.012, 28]} />
        <meshStandardMaterial color="#c9a24a" roughness={0.5} metalness={0.35} />
      </mesh>
      <InstancedBalls items={centrepiece} color="#f3c9d4" roughness={0.7} detail={[8, 6]} />
      {Array.from({ length: seats }, (_, i) => {
        const ang = (i / seats) * Math.PI * 2
        return (
          <group
            key={i}
            position={[Math.cos(ang) * (r + 0.42), 0, Math.sin(ang) * (r + 0.42)]}
            rotation={[0, -ang + Math.PI / 2, 0]}
          >
            <Chair sash={String(params.sash)} />
          </group>
        )
      })}
    </group>
  )
}

export function roundTableBom(params: Record<string, number | string>) {
  const seats = Math.round(Number(params.seats))
  return [
    { label: 'Round table', qty: 1, unit: 'pcs', rate: 350 },
    { label: 'Table cloth + runner', qty: 1, unit: 'set', rate: 280 },
    { label: 'Centrepiece', qty: 1, unit: 'pcs', rate: 650 },
    { label: 'Banquet chair', qty: seats, unit: 'pcs', rate: 45 },
    { label: 'Chair sash', qty: seats, unit: 'pcs', rate: 25 },
  ]
}
