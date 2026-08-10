import { useMemo } from 'react'
import {
  archPoint,
  InstancedBalls,
  jitter,
  palette,
  rnd,
  swagPoint,
  type PaletteName,
  type Placement,
} from '../instanced'
import type { GeneratorProps } from '../registry'

/** Dense small blooms packed along an arch — a flower gate / entrance arch. */
export function FloralArch({ params }: GeneratorProps) {
  const span = Number(params.span)
  const rise = Number(params.rise)
  const density = Number(params.density)
  const bloom = Number(params.bloom)
  const pal = palette[params.palette as PaletteName] ?? palette.blush

  const { flowers, foliage } = useMemo(() => {
    const n = Math.max(8, Math.round(span * density * 8))
    const flowers: Placement[] = []
    const foliage: Placement[] = []
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const [x, y] = archPoint(t, span, rise)
      const seed = i
      const p: [number, number, number] = [
        x + jitter(seed, 1, bloom * 1.5),
        y + jitter(seed, 2, bloom * 1.5),
        jitter(seed, 3, bloom * 1.6),
      ]
      // Roughly a third greenery keeps it from reading as a plastic ball.
      if (rnd(seed, 9) < 0.34) {
        foliage.push({ p, s: bloom * (0.7 + rnd(seed, 5) * 0.6) })
      } else {
        flowers.push({
          p,
          s: bloom * (0.75 + rnd(seed, 4) * 0.55),
          c: pal[Math.floor(rnd(seed, 6) * pal.length)],
        })
      }
    }
    return { flowers, foliage }
  }, [span, rise, density, bloom, pal])

  return (
    <group>
      <InstancedBalls items={foliage} color="#3f6b3a" roughness={0.85} detail={[8, 6]} />
      <InstancedBalls items={flowers} color={pal[0]} roughness={0.7} detail={[10, 8]} />
    </group>
  )
}

export function floralArchBom(params: Record<string, number | string>) {
  const span = Number(params.span)
  const rise = Number(params.rise)
  // Arc length of a half-sine, approximated well enough for a quotation.
  const runFt = (span + rise * 1.6) * 3.28
  return [
    { label: 'Fresh flowers (arch)', qty: Math.ceil(runFt * 1.2), unit: 'bunch', rate: 120 },
    { label: 'Greenery filler', qty: Math.ceil(runFt * 0.5), unit: 'bunch', rate: 70 },
    { label: 'Metal arch frame', qty: 1, unit: 'set', rate: 1800 },
  ]
}

/** Hanging marigold strings — the workhorse of Indian event decor. */
export function MarigoldStrings({ params }: GeneratorProps) {
  const width = Number(params.width)
  const drop = Number(params.drop)
  const count = Math.round(Number(params.count))
  const bead = Number(params.bead)
  const pal = palette[params.palette as PaletteName] ?? palette.marigold

  const items = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    const perString = Math.max(3, Math.round(drop / (bead * 1.7)))
    for (let s = 0; s < count; s++) {
      const x = count === 1 ? 0 : (s / (count - 1) - 0.5) * width
      // Alternating string lengths; a perfectly level fringe looks machine-made.
      const len = drop * (0.72 + rnd(s, 21) * 0.45)
      const beads = Math.max(3, Math.round(len / (bead * 1.7)))
      for (let i = 0; i < beads; i++) {
        const y = -(i + 1) * (len / beads)
        out.push({
          p: [x + jitter(s * 31 + i, 1, bead * 0.18), y, jitter(s * 31 + i, 2, bead * 0.18)],
          s: bead * (0.85 + rnd(s * 31 + i, 3) * 0.3),
          c: pal[Math.floor(rnd(s * 31 + i, 4) * pal.length)],
        })
      }
      void perString
    }
    return out
  }, [width, drop, count, bead, pal])

  return <InstancedBalls items={items} color={pal[0]} roughness={0.8} detail={[8, 6]} />
}

export function marigoldBom(params: Record<string, number | string>) {
  const count = Math.round(Number(params.count))
  const drop = Number(params.drop)
  const totalFt = count * drop * 3.28
  return [
    { label: 'Marigold string', qty: Math.ceil(totalFt), unit: 'ft', rate: 18 },
    { label: 'Hanging hooks', qty: count, unit: 'pcs', rate: 5 },
  ]
}

/** A swagged floral garland for table edges and stage fronts. */
export function FloralSwag({ params }: GeneratorProps) {
  const span = Number(params.span)
  const sag = Number(params.sag)
  const bloom = Number(params.bloom)
  const pal = palette[params.palette as PaletteName] ?? palette.white

  const { flowers, foliage } = useMemo(() => {
    const n = Math.max(10, Math.round(span * 26))
    const flowers: Placement[] = []
    const foliage: Placement[] = []
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const [x, y] = swagPoint(t, span, sag)
      const p: [number, number, number] = [
        x + jitter(i, 1, bloom),
        y + jitter(i, 2, bloom),
        jitter(i, 3, bloom),
      ]
      if (rnd(i, 8) < 0.45) foliage.push({ p, s: bloom * (0.8 + rnd(i, 5) * 0.5) })
      else
        flowers.push({
          p,
          s: bloom * (0.7 + rnd(i, 4) * 0.5),
          c: pal[Math.floor(rnd(i, 6) * pal.length)],
        })
    }
    return { flowers, foliage }
  }, [span, sag, bloom, pal])

  return (
    <group>
      <InstancedBalls items={foliage} color="#46744a" roughness={0.85} detail={[8, 6]} />
      <InstancedBalls items={flowers} color={pal[0]} roughness={0.7} detail={[10, 8]} />
    </group>
  )
}

export function floralSwagBom(params: Record<string, number | string>) {
  const span = Number(params.span)
  const ft = Math.ceil(span * 3.28)
  return [
    { label: 'Floral garland', qty: ft, unit: 'ft', rate: 95 },
    { label: 'Fixing wire / ties', qty: Math.ceil(ft / 3), unit: 'pcs', rate: 4 },
  ]
}
