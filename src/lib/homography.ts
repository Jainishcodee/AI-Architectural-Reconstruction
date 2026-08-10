import { Matrix3 } from 'three'
import type { Vec2 } from '../types'

/**
 * Solve the 3x3 homography H mapping four source points to four destination
 * points, normalised so h22 = 1.
 *
 * Each correspondence (u,v) -> (x,y) contributes two rows:
 *   [u v 1 0 0 0 -ux -vx] . h = x
 *   [0 0 0 u v 1 -uy -vy] . h = y
 * which is a plain 8x8 linear system, solved here by Gaussian elimination with
 * partial pivoting. Returns row-major [h00..h22], or null if degenerate (three
 * points collinear, or a quad the user has dragged inside-out).
 */
export function solveHomography(
  src: [Vec2, Vec2, Vec2, Vec2],
  dst: [Vec2, Vec2, Vec2, Vec2],
): number[] | null {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i]
    const [x, y] = dst[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x])
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y])
  }

  const n = 8
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    }
    if (Math.abs(A[pivot][col]) < 1e-10) return null
    ;[A[col], A[pivot]] = [A[pivot], A[col]]

    const p = A[col][col]
    for (let c = col; c <= n; c++) A[col][c] /= p

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c]
    }
  }

  const h = A.map((row) => row[n])
  if (h.some((v) => !Number.isFinite(v))) return null
  return [...h, 1]
}

/** Corners of the unit square in wall-UV space, ordered TL, TR, BR, BL. */
const WALL_UV_QUAD: [Vec2, Vec2, Vec2, Vec2] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
]

/**
 * Build the matrix the wall shader uses to turn its own UV into a lookup into
 * the photo, so the region the user marked fills the wall exactly.
 *
 * `corners` arrive in image space (origin top-left, y down) because that is what
 * the 2D corner-drag editor works in; texture space is y-up, hence the flip.
 */
export function wallUvToPhotoUv(
  corners: [Vec2, Vec2, Vec2, Vec2],
): Matrix3 | null {
  const dst = corners.map(([x, y]) => [x, 1 - y] as Vec2) as [
    Vec2,
    Vec2,
    Vec2,
    Vec2,
  ]
  const h = solveHomography(WALL_UV_QUAD, dst)
  if (!h) return null
  // Matrix3.set takes row-major and transposes internally for GLSL.
  return new Matrix3().set(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8])
}

/** The default pin: the whole photo, unwarped. */
export const FULL_FRAME: [Vec2, Vec2, Vec2, Vec2] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]

export const cloneQuad = (q: [Vec2, Vec2, Vec2, Vec2]) =>
  q.map((p) => [...p]) as [Vec2, Vec2, Vec2, Vec2]

/** True if the quad is convex and wound consistently — i.e. not dragged inside-out. */
export function isQuadValid(q: [Vec2, Vec2, Vec2, Vec2]): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const c = q[(i + 2) % 4]
    const cross =
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cross) < 1e-6) continue
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return sign !== 0
}
