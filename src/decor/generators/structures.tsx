import { useEffect, useMemo } from 'react'
import { DoubleSide, ExtrudeGeometry, Shape } from 'three'
import { InstancedBalls, jitter, palette, rnd, type PaletteName, type Placement } from '../instanced'
import type { GeneratorProps } from '../registry'

/** Four pillars, a canopy and a flowered top rail — the mandap / chuppah frame. */
export function MandapFrame({ params }: GeneratorProps) {
  const width = Number(params.width)
  const depth = Number(params.depth)
  const height = Number(params.height)
  const post = 0.09
  const pal = palette[params.palette as PaletteName] ?? palette.marigold

  const corners: [number, number][] = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ]

  const blooms = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    const perEdge = Math.round(width * 14)
    for (let e = 0; e < 4; e++) {
      const [ax, az] = corners[e]
      const [bx, bz] = corners[(e + 1) % 4]
      for (let i = 0; i < perEdge; i++) {
        const t = i / perEdge
        const seed = e * 97 + i
        out.push({
          p: [
            ax + (bx - ax) * t + jitter(seed, 1, 0.05),
            height + jitter(seed, 2, 0.06),
            az + (bz - az) * t + jitter(seed, 3, 0.05),
          ],
          s: 0.05 * (0.8 + rnd(seed, 4) * 0.6),
          c: pal[Math.floor(rnd(seed, 5) * pal.length)],
        })
      }
    }
    return out
  }, [width, depth, height, pal])

  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} castShadow receiveShadow>
          <cylinderGeometry args={[post, post * 1.15, height, 12]} />
          <meshStandardMaterial color="#cbb188" roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
      {/* Draped canopy, bowed slightly under its own weight. */}
      <mesh position={[0, height + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f6efe2" side={DoubleSide} roughness={0.9} />
      </mesh>
      <InstancedBalls items={blooms} color={pal[0]} roughness={0.75} detail={[8, 6]} />
    </group>
  )
}

export function mandapBom(params: Record<string, number | string>) {
  const width = Number(params.width)
  const depth = Number(params.depth)
  const perimFt = (width + depth) * 2 * 3.28
  return [
    { label: 'Mandap structure', qty: 1, unit: 'set', rate: 12000 },
    { label: 'Canopy fabric', qty: Math.ceil(width * depth * 10.76), unit: 'sq ft', rate: 22 },
    { label: 'Top-rail florals', qty: Math.ceil(perimFt), unit: 'ft', rate: 85 },
  ]
}

/** A stage / riser platform with a skirt. */
export function StageRiser({ params }: GeneratorProps) {
  const width = Number(params.width)
  const depth = Number(params.depth)
  const height = Number(params.height)

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#2f3440" roughness={0.85} />
      </mesh>
      <mesh position={[0, height + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 0.99, depth * 0.99]} />
        <meshStandardMaterial color={String(params.topColor)} roughness={0.7} />
      </mesh>
    </group>
  )
}

export function stageBom(params: Record<string, number | string>) {
  const width = Number(params.width)
  const depth = Number(params.depth)
  const sqft = Math.ceil(width * depth * 10.76)
  return [
    { label: 'Stage decking', qty: sqft, unit: 'sq ft', rate: 55 },
    { label: 'Stage skirting', qty: Math.ceil((width + depth) * 2 * 3.28), unit: 'ft', rate: 40 },
  ]
}

/** Pathway pillar: a column with a floral crown, placed in rows down an aisle. */
export function PathwayPillar({ params }: GeneratorProps) {
  const height = Number(params.height)
  const pal = palette[params.palette as PaletteName] ?? palette.blush

  const crown = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    for (let i = 0; i < 46; i++) {
      const ang = rnd(i, 1) * Math.PI * 2
      const rad = 0.16 + rnd(i, 2) * 0.16
      out.push({
        p: [
          Math.cos(ang) * rad,
          height + 0.1 + rnd(i, 3) * 0.18,
          Math.sin(ang) * rad,
        ],
        s: 0.055 * (0.8 + rnd(i, 4) * 0.6),
        c: pal[Math.floor(rnd(i, 5) * pal.length)],
      })
    }
    return out
  }, [height, pal])

  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.15, height, 14]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.6} metalness={0.2} />
      </mesh>
      <InstancedBalls items={crown} color={pal[0]} roughness={0.75} detail={[8, 6]} />
    </group>
  )
}

export function pillarBom() {
  return [
    { label: 'Pillar stand', qty: 1, unit: 'pcs', rate: 400 },
    { label: 'Pillar floral crown', qty: 1, unit: 'pcs', rate: 550 },
  ]
}

/**
 * Flat backdrop panel — the thing everyone photographs in front of.
 *
 * The arched variant is a flat panel with a rounded top, extruded a few
 * centimetres. It has to be built from a Shape rather than a primitive: a
 * capsule is a 3D pill, and at backdrop proportions it renders as a giant
 * bubble swallowing the stage instead of a panel standing behind it.
 */
export function BackdropPanel({ params }: GeneratorProps) {
  const width = Number(params.width)
  const height = Number(params.height)
  const shape = String(params.shape)

  const geometry = useMemo(() => {
    if (shape !== 'arch') return null
    const r = width / 2
    const straight = Math.max(0.02, height - r)
    const s = new Shape()
    s.moveTo(-r, 0)
    s.lineTo(-r, straight)
    s.absarc(0, straight, r, Math.PI, 0, true)
    s.lineTo(r, 0)
    s.closePath()
    return new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false })
  }, [width, height, shape])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (shape === 'arch' && geometry) {
    return (
      <mesh geometry={geometry} position={[0, 0, -0.04]} castShadow receiveShadow>
        <meshStandardMaterial color={String(params.color)} roughness={0.8} side={DoubleSide} />
      </mesh>
    )
  }

  return (
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, 0.08]} />
      <meshStandardMaterial color={String(params.color)} roughness={0.8} />
    </mesh>
  )
}

export function backdropBom(params: Record<string, number | string>) {
  const width = Number(params.width)
  const height = Number(params.height)
  return [
    {
      label: 'Backdrop panel',
      qty: Math.ceil(width * height * 10.76),
      unit: 'sq ft',
      rate: 65,
    },
  ]
}
