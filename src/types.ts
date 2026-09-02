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
  /**
   * Which wing the surface belongs to. Optional so projects saved before wings
   * existed still load — a missing id resolves to the first wing.
   */
  wingId?: string
  corners: [Vec2, Vec2, Vec2, Vec2]
  opacity: number
  visible: boolean
  /** Which estimator tier proposed `corners`, for the correction log. */
  proposedBy: 'manual' | 'vanishing-point' | 'depth'
}

/**
 * One rectangular block of a venue, axis-aligned, standing on the ground plane.
 *
 * A venue is a list of these rather than a single box because real halls turn
 * corners: a foyer opening into a hall, an L-shaped banquet room, a stage alcove.
 * Each wing carries its own ceiling height — a low entrance running into a high
 * hall is the common case, and forcing one height across the venue would make
 * exactly that shape unrepresentable.
 *
 * Wings are never rotated. An L, T or U shape is fully described by axis-aligned
 * rectangles, and allowing rotation would buy nothing while making the shared-wall
 * maths below far harder.
 */
export interface Wing {
  id: string
  name: string
  /** Centre of the footprint on the ground plane, metres. */
  x: number
  z: number
  /** Metres. Displayed in feet — Indian decor is quoted in feet. */
  width: number
  depth: number
  height: number
}

export interface Venue {
  mode: VenueMode
  wings: Wing[]
}

/** Axis-aligned footprint of a wing. */
export interface Bounds {
  xMin: number
  xMax: number
  zMin: number
  zMax: number
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
