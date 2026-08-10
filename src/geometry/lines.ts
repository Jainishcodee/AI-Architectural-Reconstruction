/**
 * Minimal line detection: Sobel gradients into a gradient-oriented Hough
 * transform.
 *
 * Written by hand rather than pulled from OpenCV.js because that is ~8 MB of
 * wasm to run an edge filter, and this tool has to stay usable offline on a
 * decorator's laptop. Gradient-oriented voting (each edge pixel votes only near
 * its own normal direction, not across all 180 angles) makes it both faster and
 * far cleaner than a naive Hough.
 */

export interface Line {
  /** Angle of the line's *normal*, radians in [0, π). */
  theta: number
  /** Distance from origin, pixels. */
  rho: number
  score: number
}

export interface DetectOptions {
  /** Longest side of the working image. Detail beyond this is noise here. */
  maxSide?: number
  /** Fraction of the peak gradient magnitude an edge pixel must reach. */
  edgeThreshold?: number
  maxLines?: number
}

export interface Detection {
  lines: Line[]
  width: number
  height: number
}

export function detectLines(
  img: HTMLImageElement,
  { maxSide = 420, edgeThreshold = 0.11, maxLines = 60 }: DetectOptions = {},
): Detection {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(16, Math.round(img.width * k))
  const h = Math.max(16, Math.round(img.height * k))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255
  }

  const THETA_BINS = 180
  const diag = Math.ceil(Math.hypot(w, h))
  const RHO_BINS = diag * 2 + 1
  const acc = new Float32Array(THETA_BINS * RHO_BINS)

  const cos = new Float32Array(THETA_BINS)
  const sin = new Float32Array(THETA_BINS)
  for (let t = 0; t < THETA_BINS; t++) {
    const a = (t * Math.PI) / THETA_BINS
    cos[t] = Math.cos(a)
    sin[t] = Math.sin(a)
  }

  // Pass 1: gradient magnitudes, to set an image-relative threshold.
  const mag = new Float32Array(w * h)
  const dirBin = new Int16Array(w * h)
  let maxMag = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] -
        gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
      const gy =
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] -
        gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
      const m = Math.hypot(gx, gy)
      mag[i] = m
      if (m > maxMag) maxMag = m
      // Normal angle folded into [0, π).
      let a = Math.atan2(gy, gx)
      if (a < 0) a += Math.PI
      if (a >= Math.PI) a -= Math.PI
      dirBin[i] = Math.min(THETA_BINS - 1, Math.round((a / Math.PI) * THETA_BINS))
    }
  }

  const cutoff = maxMag * edgeThreshold
  const SPREAD = 2

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const m = mag[i]
      if (m < cutoff) continue
      const base = dirBin[i]
      for (let d = -SPREAD; d <= SPREAD; d++) {
        const t = (base + d + THETA_BINS) % THETA_BINS
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag
        if (rho < 0 || rho >= RHO_BINS) continue
        // Votes fall off away from the pixel's own gradient direction.
        acc[t * RHO_BINS + rho] += m * (1 - Math.abs(d) / (SPREAD + 1))
      }
    }
  }

  const lines = extractPeaks(acc, THETA_BINS, RHO_BINS, diag, maxLines)
  return { lines, width: w, height: h }
}

function extractPeaks(
  acc: Float32Array,
  THETA_BINS: number,
  RHO_BINS: number,
  diag: number,
  maxLines: number,
): Line[] {
  let peak = 0
  for (let i = 0; i < acc.length; i++) if (acc[i] > peak) peak = acc[i]
  if (peak <= 0) return []

  const candidates: Line[] = []
  // Kept low deliberately. A single very high-contrast edge (a dark skirting
  // board, a doorway) sets `peak`, and a stricter floor lets it mask the
  // lower-contrast ceiling and wall junctions that actually bound the surface.
  const floor = peak * 0.08
  for (let t = 0; t < THETA_BINS; t++) {
    for (let r = 1; r < RHO_BINS - 1; r++) {
      const v = acc[t * RHO_BINS + r]
      if (v < floor) continue
      // Local maximum in rho — cheap 1D non-max suppression.
      if (v < acc[t * RHO_BINS + r - 1] || v < acc[t * RHO_BINS + r + 1]) continue
      candidates.push({ theta: (t * Math.PI) / THETA_BINS, rho: r - diag, score: v })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  // Greedy suppression so one strong edge does not return as a dozen lines.
  const minRhoGap = diag * 0.035
  const minThetaGap = (6 * Math.PI) / 180
  const kept: Line[] = []
  for (const c of candidates) {
    if (kept.length >= maxLines) break
    if (!kept.some((k) => sameLine(k, c, minThetaGap, minRhoGap))) kept.push(c)
  }
  return kept
}

/**
 * Whether two (theta, rho) pairs describe the same physical line.
 *
 * theta lives in [0, π), so a near-vertical edge shows up at both ~0° and ~180°
 * — and at the wrap the normal flips, taking rho's sign with it. Comparing rho
 * without accounting for that leaves every vertical in the image duplicated,
 * which then reads as two separate room corners.
 */
function sameLine(a: Line, b: Line, minThetaGap: number, minRhoGap: number): boolean {
  let dt = a.theta - b.theta
  let rhoB = b.rho
  if (dt > Math.PI / 2) {
    dt -= Math.PI
    rhoB = -rhoB
  } else if (dt < -Math.PI / 2) {
    dt += Math.PI
    rhoB = -rhoB
  }
  return Math.abs(dt) < minThetaGap && Math.abs(a.rho - rhoB) < minRhoGap
}

/** Intersection of two lines in (theta, rho) form, or null if near-parallel. */
export function intersect(a: Line, b: Line): [number, number] | null {
  const d = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta)
  if (Math.abs(d) < 1e-6) return null
  const x = (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / d
  const y = (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / d
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return [x, y]
}

/** x where a near-vertical line crosses the given y. */
export function xAt(line: Line, y: number): number {
  const c = Math.cos(line.theta)
  if (Math.abs(c) < 1e-6) return Number.NaN
  return (line.rho - y * Math.sin(line.theta)) / c
}

/** y where a near-horizontal line crosses the given x. */
export function yAt(line: Line, x: number): number {
  const s = Math.sin(line.theta)
  if (Math.abs(s) < 1e-6) return Number.NaN
  return (line.rho - x * Math.cos(line.theta)) / s
}
