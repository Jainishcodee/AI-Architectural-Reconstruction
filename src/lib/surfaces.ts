import type { SurfaceId, Vec3, Venue } from '../types'

export interface SurfaceFrame {
  id: SurfaceId
  position: Vec3
  rotation: Vec3
  /** Plane dimensions in metres, before any photo is applied. */
  width: number
  height: number
}

export const INDOOR_SURFACES: SurfaceId[] = [
  'floor',
  'ceiling',
  'north',
  'south',
  'east',
  'west',
]
export const OUTDOOR_SURFACES: SurfaceId[] = ['floor', 'north']

export function surfacesFor(venue: Venue): SurfaceId[] {
  return venue.mode === 'indoor' ? INDOOR_SURFACES : OUTDOOR_SURFACES
}

const HALF_PI = Math.PI / 2

/**
 * Place a plane for one surface of the venue box. The room is centred on the
 * origin with the floor at y=0, so decor placement can raycast against y=0
 * without any offset bookkeeping.
 */
export function surfaceFrame(id: SurfaceId, venue: Venue): SurfaceFrame {
  const { width: w, depth: d, height: h } = venue
  switch (id) {
    case 'floor':
      return {
        id,
        position: [0, 0, 0],
        rotation: [-HALF_PI, 0, 0],
        width: w,
        height: d,
      }
    case 'ceiling':
      return {
        id,
        position: [0, h, 0],
        rotation: [HALF_PI, 0, 0],
        width: w,
        height: d,
      }
    case 'north':
      return {
        id,
        position: [0, h / 2, -d / 2],
        rotation: [0, 0, 0],
        width: w,
        height: h,
      }
    case 'south':
      return {
        id,
        position: [0, h / 2, d / 2],
        rotation: [0, Math.PI, 0],
        width: w,
        height: h,
      }
    case 'west':
      return {
        id,
        position: [-w / 2, h / 2, 0],
        rotation: [0, HALF_PI, 0],
        width: d,
        height: h,
      }
    case 'east':
      return {
        id,
        position: [w / 2, h / 2, 0],
        rotation: [0, -HALF_PI, 0],
        width: d,
        height: h,
      }
  }
}
