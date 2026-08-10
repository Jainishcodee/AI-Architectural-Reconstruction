/**
 * Knock the background out of a prop photo so it can stand in the scene as a
 * cutout.
 *
 * This is a deliberately cheap flood fill from the image border, not a learned
 * matting model: decorators shoot props against a plain wall or floor, it runs
 * instantly and offline, and — crucially — it fails visibly rather than subtly,
 * so the user knows to retouch instead of shipping a haloed cutout to a client.
 */
export async function removeBackground(
  src: string,
  tolerance = 42,
): Promise<{ url: string; width: number; height: number }> {
  const img = await loadImage(src)

  // Cap the working size: a 12MP phone photo would flood-fill for seconds.
  const maxSide = 1024
  const k = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * k))
  const h = Math.max(1, Math.round(img.height * k))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)

  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  const visited = new Uint8Array(w * h)
  const stack: number[] = []

  // Seed from every border pixel — the background is whatever touches the edge.
  for (let x = 0; x < w; x++) {
    stack.push(x, x + (h - 1) * w)
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, w - 1 + y * w)
  }

  const seedR = data[0]
  const seedG = data[1]
  const seedB = data[2]
  const tol2 = tolerance * tolerance * 3

  while (stack.length) {
    const idx = stack.pop()!
    if (idx < 0 || idx >= w * h || visited[idx]) continue
    const o = idx * 4
    const dr = data[o] - seedR
    const dg = data[o + 1] - seedG
    const db = data[o + 2] - seedB
    if (dr * dr + dg * dg + db * db > tol2) continue

    visited[idx] = 1
    data[o + 3] = 0

    const x = idx % w
    if (x > 0) stack.push(idx - 1)
    if (x < w - 1) stack.push(idx + 1)
    stack.push(idx - w, idx + w)
  }

  // Soften the cut edge so the cutout does not read as a sticker.
  feather(data, visited, w, h)

  ctx.putImageData(image, 0, 0)
  return { url: canvas.toDataURL('image/png'), width: w, height: h }
}

function feather(
  data: Uint8ClampedArray,
  visited: Uint8Array,
  w: number,
  h: number,
) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (visited[i]) continue
      let cleared = 0
      if (visited[i - 1]) cleared++
      if (visited[i + 1]) cleared++
      if (visited[i - w]) cleared++
      if (visited[i + w]) cleared++
      if (cleared) data[i * 4 + 3] = Math.round(255 * (1 - cleared / 5))
    }
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = src
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error(`Could not read ${file.name}`))
    fr.readAsDataURL(file)
  })
}
