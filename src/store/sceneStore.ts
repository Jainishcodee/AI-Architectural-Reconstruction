import { create } from 'zustand'
import { temporal } from 'zundo'
import { cloneQuad, FULL_FRAME } from '../lib/homography'
import type {
  CorrectionEvent,
  DecorInstance,
  PhotoAsset,
  PhotoPin,
  SurfaceId,
  Vec2,
  Vec3,
  Venue,
  VenueMode,
} from '../types'

export type LightingPreset = 'day' | 'golden' | 'evening' | 'night'
export type CameraMode = 'orbit' | 'walk'

interface SceneState {
  venue: Venue
  photos: PhotoAsset[]
  pins: PhotoPin[]
  items: DecorInstance[]

  selectedItemId: string | null
  editingPinId: string | null
  lighting: LightingPreset
  cameraMode: CameraMode

  /**
   * Set once the user calibrates against a known real-world length. Decor
   * placement is blocked until then — an uncalibrated scene produces a
   * confident, wrong bill of materials, which is worse than no BOM at all.
   */
  calibrated: boolean

  /** Training data for the correction flywheel. Logged now, trained on later. */
  corrections: CorrectionEvent[]

  setVenueMode: (mode: VenueMode) => void
  setVenueSize: (dims: Partial<Pick<Venue, 'width' | 'depth' | 'height'>>) => void
  /** Uniformly rescale the room so a measured span equals its real length. */
  applyCalibration: (measured: number, actual: number) => void

  addPhoto: (photo: PhotoAsset) => void
  removePhoto: (photoId: string) => void
  pinPhoto: (photoId: string, surface: SurfaceId) => void
  updatePin: (pinId: string, patch: Partial<PhotoPin>) => void
  removePin: (pinId: string) => void
  setEditingPin: (pinId: string | null) => void

  addItem: (type: string, position: Vec3, params?: DecorInstance['params']) => void
  updateItem: (id: string, patch: Partial<DecorInstance>) => void
  removeItem: (id: string) => void
  duplicateItem: (id: string) => void
  selectItem: (id: string | null) => void

  setLighting: (preset: LightingPreset) => void
  setCameraMode: (mode: CameraMode) => void

  logCorrection: (event: CorrectionEvent) => void
  loadProject: (snapshot: ProjectSnapshot) => void
  reset: () => void
}

export interface ProjectSnapshot {
  venue: Venue
  photos: PhotoAsset[]
  pins: PhotoPin[]
  items: DecorInstance[]
  calibrated: boolean
  lighting: LightingPreset
  corrections: CorrectionEvent[]
}

/** Roughly a 40 x 30 x 13 ft hall — a plausible mid-size banquet space. */
const DEFAULT_VENUE: Venue = {
  mode: 'indoor',
  width: 12,
  depth: 9,
  height: 4,
}

const uid = () => crypto.randomUUID()

export const useScene = create<SceneState>()(
  temporal(
    (set, get) => ({
      venue: { ...DEFAULT_VENUE },
      photos: [],
      pins: [],
      items: [],
      selectedItemId: null,
      editingPinId: null,
      // Open bright: an empty room under the evening preset reads as a bug.
      lighting: 'day',
      cameraMode: 'orbit',
      calibrated: false,
      corrections: [],

      setVenueMode: (mode) =>
        set((s) => {
          // Outdoor keeps only the ground and the backdrop; drop orphaned pins.
          const kept: SurfaceId[] =
            mode === 'outdoor' ? ['floor', 'north'] : [
              'floor', 'ceiling', 'north', 'south', 'east', 'west',
            ]
          return {
            venue: { ...s.venue, mode },
            pins: s.pins.filter((p) => kept.includes(p.surface)),
          }
        }),

      setVenueSize: (dims) =>
        set((s) => ({ venue: { ...s.venue, ...dims } })),

      applyCalibration: (measured, actual) =>
        set((s) => {
          if (measured <= 0 || actual <= 0) return s
          const k = actual / measured
          return {
            venue: {
              ...s.venue,
              width: s.venue.width * k,
              depth: s.venue.depth * k,
              height: s.venue.height * k,
            },
            // Decor keeps its relative place in the room as the room rescales.
            items: s.items.map((it) => ({
              ...it,
              position: it.position.map((v) => v * k) as Vec3,
            })),
            calibrated: true,
          }
        }),

      addPhoto: (photo) => set((s) => ({ photos: [...s.photos, photo] })),

      removePhoto: (photoId) =>
        set((s) => ({
          photos: s.photos.filter((p) => p.id !== photoId),
          pins: s.pins.filter((p) => p.photoId !== photoId),
        })),

      pinPhoto: (photoId, surface) => {
        const id = uid()
        set((s) => ({
          // One photo per surface: replace rather than stack.
          pins: [
            ...s.pins.filter((p) => p.surface !== surface),
            {
              id,
              photoId,
              surface,
              corners: cloneQuad(FULL_FRAME),
              opacity: 1,
              visible: true,
              proposedBy: 'manual',
            },
          ],
          editingPinId: id,
        }))
      },

      updatePin: (pinId, patch) =>
        set((s) => ({
          pins: s.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)),
        })),

      removePin: (pinId) =>
        set((s) => ({
          pins: s.pins.filter((p) => p.id !== pinId),
          editingPinId: s.editingPinId === pinId ? null : s.editingPinId,
        })),

      setEditingPin: (pinId) => set({ editingPinId: pinId }),

      addItem: (type, position, params = {}) => {
        const id = uid()
        set((s) => ({
          items: [
            ...s.items,
            { id, type, position, rotationY: 0, params: { ...params } },
          ],
          selectedItemId: id,
        }))
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, ...patch, params: { ...it.params, ...(patch.params ?? {}) } } : it,
          ),
        })),

      removeItem: (id) =>
        set((s) => ({
          items: s.items.filter((it) => it.id !== id),
          selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
        })),

      duplicateItem: (id) => {
        const src = get().items.find((it) => it.id === id)
        if (!src) return
        const copy: DecorInstance = {
          ...src,
          id: uid(),
          params: { ...src.params },
          position: [src.position[0] + 0.8, src.position[1], src.position[2]],
        }
        set((s) => ({ items: [...s.items, copy], selectedItemId: copy.id }))
      },

      selectItem: (id) => set({ selectedItemId: id }),
      setLighting: (preset) => set({ lighting: preset }),
      setCameraMode: (mode) => set({ cameraMode: mode, selectedItemId: null }),

      logCorrection: (event) =>
        set((s) => ({ corrections: [...s.corrections, event] })),

      loadProject: (snapshot) =>
        set({
          ...snapshot,
          selectedItemId: null,
          editingPinId: null,
          cameraMode: 'orbit',
        }),

      reset: () =>
        set({
          venue: { ...DEFAULT_VENUE },
          photos: [],
          pins: [],
          items: [],
          selectedItemId: null,
          editingPinId: null,
          calibrated: false,
          corrections: [],
        }),
    }),
    {
      limit: 100,
      // Selection, camera and the append-only correction log are not edits;
      // undoing across them would feel broken.
      partialize: (s) => ({
        venue: s.venue,
        photos: s.photos,
        pins: s.pins,
        items: s.items,
        calibrated: s.calibrated,
        lighting: s.lighting,
      }),
    },
  ),
)

export const useTemporal = () => useScene.temporal.getState()

export function snapshot(): ProjectSnapshot {
  const s = useScene.getState()
  return {
    venue: s.venue,
    photos: s.photos,
    pins: s.pins,
    items: s.items,
    calibrated: s.calibrated,
    lighting: s.lighting,
    corrections: s.corrections,
  }
}

export const selectPinFor = (surface: SurfaceId) => (s: SceneState) =>
  s.pins.find((p) => p.surface === surface)

export const photoById = (photos: PhotoAsset[], id: string) =>
  photos.find((p) => p.id === id)

export type { Vec2 }
