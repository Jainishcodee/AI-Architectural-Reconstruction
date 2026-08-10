import { loadImage } from '../lib/removeBg'
import { isQuadValid } from '../lib/homography'
import { detectLines, intersect, xAt, yAt, type Line } from './lines'
import type { SurfaceId, Vec2 } from '../types'

export type EstimatorResult =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; corners: [Vec2, Vec2, Vec2, Vec2]; lineCount: number; confidence: number }
  | { status: 'declined'; reason: string }

/** How far from axis-aligned a line's normal may sit and still count. */
const ANGLE_TOLERANCE = (34 * Math.PI) / 180

/**
 * Tier 1 geometry: propose the quad of a wall as it appears in a photo, from
 * its bounding edges.
 *
 * The wall a decorator photographs is nearly always bounded by the four
 * strongest straight edges in the frame — ceiling line, floor line, and the two
 * vertical room corners — so this looks for exactly that rather than attempting
 * a full Manhattan solve.
 *
 * Declining is a first-class outcome. A confidently wrong auto-align is worse
 * than none at all, because the user stops checking it.
 */
export async function estimateSurfaceQuad(
  src: string,
  surface: SurfaceId,
): Promise<EstimatorResult> {
  let img: HTMLImageElement
  try {
    img = await loadImage(src)
  } catch {
    return { status: 'declined', reason: 'the image could not be read.' }
  }

  // Yield a frame so the "Detecting…" label paints before the main thread blocks.
  await new Promise((r) => setTimeout(r, 0))

  const { lines, width, height } = detectLines(img)
  if (lines.length < 4) {
    return {
      status: 'declined',
      reason: 'there are too few straight edges in this shot.',
    }
  }

  const verticals: Line[] = []
  const horizontals: Line[] = []
  for (const l of lines) {
    // theta is the normal angle: near 0/π means a vertical line in the image.
    const fromVertical = Math.min(l.theta, Math.PI - l.theta)
    const fromHorizontal = Math.abs(l.theta - Math.PI / 2)
    if (fromVertical < ANGLE_TOLERANCE) verticals.push(l)
    else if (fromHorizontal < ANGLE_TOLERANCE) horizontals.push(l)
  }

  const vBounds = chooseBounds(verticals, (l) => xAt(l, height / 2), width, 'vertical')
  const hBounds = chooseBounds(horizontals, (l) => yAt(l, width / 2), height, 'horizontal')

  // At least half the bounds must come from real edges. If almost everything
  // fell back to the frame, auto-align would just be returning the whole photo
  // dressed up as a detection.
  const detected = [vBounds.loReal, vBounds.hiReal, hBounds.loReal, hBounds.hiReal].filter(
    Boolean,
  ).length
  if (detected < 2) {
    return {
      status: 'declined',
      reason:
        surface === 'floor'
          ? 'the floor edges are not clear enough here.'
          : 'the wall edges are not clear enough here.',
    }
  }

  const left = vBounds.lo
  const right = vBounds.hi
  const top = hBounds.lo
  const bottom = hBounds.hi

  const tl = intersect(top, left)
  const tr = intersect(top, right)
  const br = intersect(bottom, right)
  const bl = intersect(bottom, left)
  if (!tl || !tr || !br || !bl) {
    return { status: 'declined', reason: 'the detected edges are parallel.' }
  }

  const corners = [tl, tr, br, bl].map(
    ([x, y]) => [x / width, y / height] as Vec2,
  ) as [Vec2, Vec2, Vec2, Vec2]

  // Allow a little overshoot — a wall often runs past the frame — but reject
  // intersections thrown far outside the photo.
  if (corners.some(([x, y]) => x < -0.35 || x > 1.35 || y < -0.35 || y > 1.35)) {
    return {
      status: 'declined',
      reason: 'the edges meet outside the frame, so the surface is not fully visible.',
    }
  }

  if (!isQuadValid(corners)) {
    return { status: 'declined', reason: 'the detected edges do not form a proper quad.' }
  }

  const area = quadArea(corners)
  if (area < 0.12) {
    return {
      status: 'declined',
      reason: 'the detected surface covers too little of the frame to be the main wall.',
    }
  }

  return {
    status: 'ok',
    corners,
    lineCount: detected,
    confidence: detected / 4,
  }
}

/** How far in from an edge a line may sit and still count as that boundary. */
const BAND = 0.42

/**
 * Pick the two lines bounding the surface along one axis.
 *
 * A venue photo very often has the wall running out past the edge of the frame,
 * so only one true room corner is visible. Rather than give up, the frame edge
 * stands in as that bound — the visible extent of the wall genuinely is the edge
 * of the photo. `loReal`/`hiReal` record which bounds were actually detected so
 * the caller can refuse when nearly everything was a fallback.
 */
function chooseBounds(
  candidates: Line[],
  coordinate: (l: Line) => number,
  extent: number,
  axis: 'vertical' | 'horizontal',
): { lo: Line; hi: Line; loReal: boolean; hiReal: boolean } {
  const scored = candidates
    .map((l) => ({ l, c: coordinate(l) }))
    .filter((s) => Number.isFinite(s.c) && s.c > -extent * 0.2 && s.c < extent * 1.2)

  const loBand = scored.filter((s) => s.c < extent * BAND)
  const hiBand = scored.filter((s) => s.c > extent * (1 - BAND))

  // Outermost within each band: the wall's own boundary, not a door frame or
  // window edge sitting inside it.
  const lo = loBand.length ? loBand.reduce((a, b) => (b.c < a.c ? b : a)) : null
  const hi = hiBand.length ? hiBand.reduce((a, b) => (b.c > a.c ? b : a)) : null

  const theta = axis === 'vertical' ? 0 : Math.PI / 2
  const frame = (rho: number): Line => ({ theta, rho, score: 0 })

  return {
    lo: lo?.l ?? frame(0),
    hi: hi?.l ?? frame(extent),
    loReal: Boolean(lo),
    hiReal: Boolean(hi),
  }
}

/** Shoelace area of the quad in normalised units. */
function quadArea(q: [Vec2, Vec2, Vec2, Vec2]): number {
  let a = 0
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i]
    const [x2, y2] = q[(i + 1) % 4]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}
