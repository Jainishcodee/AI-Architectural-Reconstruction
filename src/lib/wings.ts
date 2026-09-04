import type { Bounds, SurfaceId, Vec3, Venue, Wing } from '../types'

/** Metres. Two wings within this distance of each other count as touching. */
const EPS = 1e-4

const HALF_PI = Math.PI / 2

export type WallSide = Extract<SurfaceId, 'north' | 'south' | 'east' | 'west'>

export const WALL_SIDES: WallSide[] = ['north', 'south', 'east', 'west']

export function boundsOf(wing: Wing): Bounds {
  return {
    xMin: wing.x - wing.width / 2,
    xMax: wing.x + wing.width / 2,
    zMin: wing.z - wing.depth / 2,
    zMax: wing.z + wing.depth / 2,
  }
}

export function venueBounds(venue: Venue): Bounds {
  const all = venue.wings.map(boundsOf)
  if (!all.length) return { xMin: -1, xMax: 1, zMin: -1, zMax: 1 }
  return {
    xMin: Math.min(...all.map((b) => b.xMin)),
    xMax: Math.max(...all.map((b) => b.xMax)),
    zMin: Math.min(...all.map((b) => b.zMin)),
    zMax: Math.max(...all.map((b) => b.zMax)),
  }
}

export const venueWidth = (v: Venue) => {
  const b = venueBounds(v)
  return b.xMax - b.xMin
}
export const venueDepth = (v: Venue) => {
  const b = venueBounds(v)
  return b.zMax - b.zMin
}
export const venueHeight = (v: Venue) =>
  v.wings.length ? Math.max(...v.wings.map((w) => w.height)) : 3

export const primaryWing = (v: Venue): Wing | undefined => v.wings[0]

export function findWing(v: Venue, wingId?: string): Wing | undefined {
  // A missing id means a pin saved before wings existed: it belongs to the
  // original single room, which migration puts first.
  if (!wingId) return v.wings[0]
  return v.wings.find((w) => w.id === wingId) ?? v.wings[0]
}

/**
 * Legacy venues were a single `{ width, depth, height }` box. Rebuild them as a
 * one-wing venue centred on the origin, so decor positions saved against the old
 * model keep meaning exactly what they meant before.
 */
export function normalizeVenue(venue: unknown): Venue {
  const v = venue as Partial<Venue> & {
    width?: number
    depth?: number
    height?: number
  }
  if (v?.wings?.length) return { mode: v.mode ?? 'indoor', wings: v.wings }
  return {
    mode: v?.mode ?? 'indoor',
    wings: [
      {
        id: crypto.randomUUID(),
        name: 'Main',
        x: 0,
        z: 0,
        width: v?.width ?? 12,
        depth: v?.depth ?? 9,
        height: v?.height ?? 4,
      },
    ],
  }
}

/** The full extent of one wall of one wing, ignoring any openings in it. */
export interface WallRect {
  /** Along-wall length, metres. */
  width: number
  /** Floor to that wing's ceiling, metres. */
  height: number
}

export function wallRect(wing: Wing, side: WallSide): WallRect {
  const horizontal = side === 'north' || side === 'south'
  return { width: horizontal ? wing.width : wing.depth, height: wing.height }
}

export interface WallPanel {
  key: string
  wingId: string
  side: WallSide
  position: Vec3
  rotation: Vec3
  width: number
  height: number
  /**
   * Where this panel sits within its wing's whole wall, in 0..1 UV. A wall
   * broken by a doorway becomes several panels, but the photo pinned to it must
   * still span the wall as one image — each panel samples its own slice.
   */
  uv: { x: number; y: number; w: number; h: number }
}

interface Opening {
  start: number
  end: number
  /** Height up to which the wall is absent — the shorter of the two wings. */
  openTo: number
}

/**
 * Every wall panel in the venue, with the shared stretches between adjoining
 * wings removed so you can walk from one into the next.
 *
 * Each wall is treated as a 1-D interval and the overlap with any wing touching
 * it is subtracted. Where the neighbour is shorter, the wall above the opening
 * survives as a transom panel — which is exactly what a low foyer opening into a
 * high hall looks like, and the reason panels carry their own vertical range
 * rather than always running floor to ceiling.
 */
export function wallPanels(venue: Venue): WallPanel[] {
  const panels: WallPanel[] = []

  for (const wing of venue.wings) {
    const b = boundsOf(wing)

    for (const side of WALL_SIDES) {
      const horizontal = side === 'north' || side === 'south'
      const lo = horizontal ? b.xMin : b.zMin
      const hi = horizontal ? b.xMax : b.zMax
      const span = hi - lo
      if (span <= EPS) continue

      const openings = openingsOn(venue, wing, b, side)
      const segments = solidSegments(lo, hi, openings)

      for (const seg of segments) {
        panels.push(
          makePanel(wing, b, side, seg.start, seg.end, seg.yBottom, seg.yTop, lo, span),
        )
      }
    }
  }

  return panels
}

function openingsOn(venue: Venue, wing: Wing, b: Bounds, side: WallSide): Opening[] {
  const horizontal = side === 'north' || side === 'south'
  const out: Opening[] = []

  for (const other of venue.wings) {
    if (other.id === wing.id) continue
    const o = boundsOf(other)

    // The neighbour must sit flush against this wall's plane...
    const flush =
      side === 'north'
        ? Math.abs(o.zMax - b.zMin) < EPS
        : side === 'south'
          ? Math.abs(o.zMin - b.zMax) < EPS
          : side === 'west'
            ? Math.abs(o.xMax - b.xMin) < EPS
            : Math.abs(o.xMin - b.xMax) < EPS
    if (!flush) continue

    // ...and overlap it along its length.
    const start = horizontal ? Math.max(b.xMin, o.xMin) : Math.max(b.zMin, o.zMin)
    const end = horizontal ? Math.min(b.xMax, o.xMax) : Math.min(b.zMax, o.zMax)
    if (end - start <= EPS) continue

    out.push({ start, end, openTo: Math.min(wing.height, other.height) })
  }

  return out.sort((p, q) => p.start - q.start)
}

interface Segment {
  start: number
  end: number
  yBottom: number
  yTop: number
}

/** Turn a wall's length plus its openings into the pieces that remain solid. */
function solidSegments(lo: number, hi: number, openings: Opening[]): Segment[] {
  const out: Segment[] = []
  let cursor = lo

  for (const opening of openings) {
    const start = Math.max(cursor, opening.start)
    if (start - cursor > EPS) {
      out.push({ start: cursor, end: start, yBottom: 0, yTop: Number.POSITIVE_INFINITY })
    }
    // The wall above a shorter neighbour is still wall.
    if (opening.end - start > EPS) {
      out.push({
        start,
        end: opening.end,
        yBottom: opening.openTo,
        yTop: Number.POSITIVE_INFINITY,
      })
    }
    cursor = Math.max(cursor, opening.end)
  }

  if (hi - cursor > EPS) {
    out.push({ start: cursor, end: hi, yBottom: 0, yTop: Number.POSITIVE_INFINITY })
  }

  return out
}

function makePanel(
  wing: Wing,
  b: Bounds,
  side: WallSide,
  start: number,
  end: number,
  yBottom: number,
  yTopRaw: number,
  lo: number,
  span: number,
): WallPanel {
  const yTop = Number.isFinite(yTopRaw) ? Math.min(yTopRaw, wing.height) : wing.height
  const width = end - start
  const height = Math.max(EPS, yTop - yBottom)
  const mid = (start + end) / 2
  const yMid = (yBottom + yTop) / 2

  /*
    A plane's local +X maps to a different world axis per wall, because each wall
    is rotated to face inward. Getting this backwards mirrors the pinned photo,
    so the u range is flipped for the two walls whose local +X runs against the
    world axis the wall is measured along.
  */
  let position: Vec3
  let rotation: Vec3
  let u0: number

  switch (side) {
    case 'north': // z = zMin, faces +Z; local +X → world +X
      position = [mid, yMid, b.zMin]
      rotation = [0, 0, 0]
      u0 = (start - lo) / span
      break
    case 'south': // z = zMax, faces −Z; local +X → world −X
      position = [mid, yMid, b.zMax]
      rotation = [0, Math.PI, 0]
      u0 = (lo + span - end) / span
      break
    case 'west': // x = xMin, faces +X; local +X → world −Z
      position = [b.xMin, yMid, mid]
      rotation = [0, HALF_PI, 0]
      u0 = (lo + span - end) / span
      break
    case 'east': // x = xMax, faces −X; local +X → world +Z
      position = [b.xMax, yMid, mid]
      rotation = [0, -HALF_PI, 0]
      u0 = (start - lo) / span
      break
  }

  return {
    key: `${wing.id}:${side}:${start.toFixed(3)}:${yBottom.toFixed(3)}`,
    wingId: wing.id,
    side,
    position,
    rotation,
    width,
    height,
    uv: {
      x: u0,
      y: yBottom / wing.height,
      w: width / span,
      h: height / wing.height,
    },
  }
}

export interface Slab {
  key: string
  wingId: string
  kind: 'floor' | 'ceiling'
  position: Vec3
  rotation: Vec3
  width: number
  height: number
}

/** Floor and ceiling for each wing. Ceilings sit at that wing's own height. */
export function slabs(venue: Venue): Slab[] {
  const out: Slab[] = []
  for (const wing of venue.wings) {
    out.push({
      key: `${wing.id}:floor`,
      wingId: wing.id,
      kind: 'floor',
      position: [wing.x, 0, wing.z],
      rotation: [-HALF_PI, 0, 0],
      width: wing.width,
      height: wing.depth,
    })
    if (venue.mode === 'indoor') {
      out.push({
        key: `${wing.id}:ceiling`,
        wingId: wing.id,
        kind: 'ceiling',
        position: [wing.x, wing.height, wing.z],
        rotation: [HALF_PI, 0, 0],
        width: wing.width,
        height: wing.depth,
      })
    }
  }
  return out
}

/** True if the point stands on some wing's floor. Used to keep the walker inside. */
export function pointInVenue(venue: Venue, x: number, z: number, pad = 0): boolean {
  return venue.wings.some((w) => {
    const b = boundsOf(w)
    return (
      x >= b.xMin + pad && x <= b.xMax - pad && z >= b.zMin + pad && z <= b.zMax - pad
    )
  })
}

export function wingAt(venue: Venue, x: number, z: number): Wing | undefined {
  return venue.wings.find((w) => {
    const b = boundsOf(w)
    return x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax
  })
}

/**
 * Position a new wing flush against one wall of an existing one.
 *
 * The new wing always spans the host's *whole* wall, so both of its ends line up
 * exactly with the host's corners. Only the outward projection is a free
 * parameter — that is deliberately not something the caller can get wrong.
 * Sizing it shorter and centring it leaves a sliver of old wall at each end, so
 * the extension reads as starting slightly inside the room rather than at its
 * edge. Pulling one end in to make an L is a drag on a resize nub afterwards.
 */
export function attachedWing(
  host: Wing,
  side: WallSide,
  /** How far the new wing projects away from the shared wall, metres. */
  extent: number,
  height: number,
  name: string,
): Wing {
  const b = boundsOf(host)
  const base = { id: crypto.randomUUID(), name, height }

  switch (side) {
    case 'north':
      return { ...base, width: host.width, depth: extent, x: host.x, z: b.zMin - extent / 2 }
    case 'south':
      return { ...base, width: host.width, depth: extent, x: host.x, z: b.zMax + extent / 2 }
    case 'west':
      return { ...base, width: extent, depth: host.depth, x: b.xMin - extent / 2, z: host.z }
    case 'east':
      return { ...base, width: extent, depth: host.depth, x: b.xMax + extent / 2, z: host.z }
  }
}

/** Does this wing overlap any other? Overlapping footprints render as a mess. */
export function overlapsAny(venue: Venue, wing: Wing): boolean {
  const a = boundsOf(wing)
  return venue.wings.some((other) => {
    if (other.id === wing.id) return false
    const b = boundsOf(other)
    return (
      a.xMin < b.xMax - EPS &&
      a.xMax > b.xMin + EPS &&
      a.zMin < b.zMax - EPS &&
      a.zMax > b.zMin + EPS
    )
  })
}
