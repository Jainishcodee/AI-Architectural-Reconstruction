import type { SurfaceId, Venue } from '../types'

/**
 * Which surfaces of a wing accept a pinned photo.
 *
 * Wall geometry itself lives in `wings.ts` — a wall may be broken into several
 * panels by a doorway through to the next wing, so there is no single frame to
 * hand back here. This is only the list of sides a user can choose from.
 */
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
