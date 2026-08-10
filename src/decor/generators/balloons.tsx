import { useMemo } from 'react'
import {
  archPoint,
  InstancedBalls,
  jitter,
  palette,
  rnd,
  type PaletteName,
  type Placement,
} from '../instanced'
import type { GeneratorProps } from '../registry'

/** Balloons are teardrops, not spheres — the squash is most of the read. */
const BALLOON_SHAPE: [number, number, number] = [1, 1.18, 1]

/**
 * Organic balloon garland along an arch.
 *
 * Real garlands are clusters of 4 balloons twisted onto a strip, alternating
 * around the spine — not evenly spaced beads. Clustering is what stops this
 * looking like a string of pearls.
 */
export function BalloonArch({ params }: GeneratorProps) {
  const span = Number(params.span)
  const rise = Number(params.rise)
  const density = Number(params.density)
  const size = Number(params.size)
  const pal = palette[params.palette as PaletteName] ?? palette.blush

  const items = useMemo<Placement[]>(() => {
    const stations = Math.max(2, Math.round(span * density))
    const out: Placement[] = []
    for (let i = 0; i < stations; i++) {
      const t = i / (stations - 1)
      const [x, y] = archPoint(t, span, rise)
      // Tangent, so clusters sit across the spine rather than along the world axes.
      const dydt = Math.PI * Math.cos(Math.PI * t) * rise
      const len = Math.hypot(span, dydt) || 1
      const nx = -dydt / len
      const ny = span / len

      const perCluster = 4
      for (let k = 0; k < perCluster; k++) {
        const seed = i * 7 + k
        const ang = (k / perCluster) * Math.PI * 2 + rnd(seed, 3) * 0.9
        // Offset just under one balloon diameter so the cluster reads as a
        // twisted bunch rather than a single-file string of beads.
        const off = size * (0.95 + rnd(seed, 4) * 0.3)
        const r = size * (0.82 + rnd(seed, 1) * 0.36)
        out.push({
          p: [
            x + nx * Math.cos(ang) * off + jitter(seed, 5, size * 0.14),
            y + ny * Math.cos(ang) * off + jitter(seed, 6, size * 0.14),
            Math.sin(ang) * off + jitter(seed, 7, size * 0.12),
          ],
          sv: [r * BALLOON_SHAPE[0], r * BALLOON_SHAPE[1], r * BALLOON_SHAPE[2]],
          rot: [jitter(seed, 8, 0.5), 0, jitter(seed, 9, 0.5)],
          c: pal[Math.floor(rnd(seed, 2) * pal.length)],
        })
      }
    }
    return out
  }, [span, rise, density, size, pal])

  return <InstancedBalls items={items} color={pal[0]} roughness={0.24} metalness={0.08} />
}

export function balloonArchBom(params: Record<string, number | string>) {
  const span = Number(params.span)
  const density = Number(params.density)
  const stations = Math.max(2, Math.round(span * density))
  return [
    { label: 'Balloons (garland)', qty: stations * 4, unit: 'pcs', rate: 4 },
    { label: 'Balloon strip tape', qty: Math.ceil(span * 3.3), unit: 'ft', rate: 6 },
  ]
}

/** A twisted balloon column on a base — the classic entrance pair. */
export function BalloonColumn({ params }: GeneratorProps) {
  const height = Number(params.height)
  const size = Number(params.size)
  const pal = palette[params.palette as PaletteName] ?? palette.pastel

  const items = useMemo<Placement[]>(() => {
    const tiers = Math.max(2, Math.round(height / (size * 1.5)))
    const out: Placement[] = []
    for (let i = 0; i < tiers; i++) {
      const y = size * 1.1 + i * size * 1.5
      // Quarter-turn per tier gives the spiral that real columns have.
      const twist = i * 0.78
      for (let k = 0; k < 4; k++) {
        const seed = i * 11 + k
        const ang = twist + (k / 4) * Math.PI * 2
        const r = size * (0.9 + rnd(seed, 1) * 0.2)
        out.push({
          p: [Math.cos(ang) * size * 0.72, y, Math.sin(ang) * size * 0.72],
          sv: [r, r * BALLOON_SHAPE[1], r],
          rot: [0, ang, jitter(seed, 3, 0.3)],
          c: pal[(i + k) % pal.length],
        })
      }
    }
    return out
  }, [height, size, pal])

  return <InstancedBalls items={items} color={pal[0]} roughness={0.24} metalness={0.08} />
}

export function balloonColumnBom(params: Record<string, number | string>) {
  const height = Number(params.height)
  const size = Number(params.size)
  const tiers = Math.max(2, Math.round(height / (size * 1.5)))
  return [
    { label: 'Balloons (column)', qty: tiers * 4, unit: 'pcs', rate: 4 },
    { label: 'Column pole + base', qty: 1, unit: 'set', rate: 350 },
  ]
}
