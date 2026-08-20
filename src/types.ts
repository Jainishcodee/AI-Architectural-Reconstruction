export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

/** All six surfaces of an indoor box. Outdoor mode uses only `floor` + `north`. */
export type SurfaceId =
  | 'floor'
  | 'ceiling'
  | 'north'
  | 'south'
  | 'east'
  | 'west'

export const SURFACE_LABELS: Record<SurfaceId, string> = {
  floor: 'Floor',
  ceiling: 'Ceiling',
  north: 'Back wall',
  south: 'Front wall',
  east: 'Right wall',
  west: 'Left wall',
}

export type VenueMode = 'indoor' | 'outdoor'

export interface PhotoAsset {
  id: string
  name: string
  /** Data URL. Swapped for a Blob in IndexedDB at Phase 5. */
  src: string
  width: number
  height: number
}

/**
 * A photo pinned to one surface.
 *
 * `corners` are the four points *in normalised photo space* (0..1, origin
 * top-left) that the user has marked as the corners of that surface, ordered
 * TL, TR, BR, BL. They are fed through a homography in the shader so an angled
 * shot rectifies onto the wall in real time. Defaults to the full image.
 */
export interface PhotoPin {
  id: string
  photoId: string
  surface: SurfaceId
  corners: [Vec2, Vec2, Vec2, Vec2]
  opacity: number
  visible: boolean
  /** Which estimator tier proposed `corners`, for the correction log. */
  proposedBy: 'manual' | 'vanishing-point' | 'depth'
}

export interface Venue {
  mode: VenueMode
  /** Metres. Displayed in feet — Indian decor is quoted in feet. */
  width: number
  depth: number
  height: number
}

export type LightingPreset = 'day' | 'golden' | 'evening' | 'night'

/**
 * One physical space in a project — a hall, a lawn, an entrance, a facade.
 *
 * A project is a list of these rather than a single room because photos of a
 * building's front, back and interior share no visible geometry and cannot be
 * registered into one model by any method. They are genuinely separate scenes
 * that happen to belong to the same event, so that is exactly how they are
 * stored: independent geometry, one shared photo pool, one combined quote.
 */
export interface Space {
  id: string
  name: string
  venue: Venue
  pins: PhotoPin[]
  items: DecorInstance[]
  calibrated: boolean
  lighting: LightingPreset
}

export interface DecorInstance {
  id: string
  /** Key into the decor registry. */
  type: string
  position: Vec3
  rotationY: number
  params: Record<string, number | string>
}

export interface CorrectionEvent {
  photoId: string
  surface: SurfaceId
  proposedBy: PhotoPin['proposedBy']
  proposed: [Vec2, Vec2, Vec2, Vec2]
  final: [Vec2, Vec2, Vec2, Vec2]
  msSpentAdjusting: number
}

export interface BomLine {
  label: string
  qty: number
  unit: string
  /** Rupees per unit. Editable in the BOM panel. */
  rate: number
}

export const FEET_PER_METRE = 3.28084

export const toFeet = (m: number) => m * FEET_PER_METRE
export const fromFeet = (ft: number) => ft / FEET_PER_METRE
export const fmtFeet = (m: number) => `${toFeet(m).toFixed(1)} ft`
