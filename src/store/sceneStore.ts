import { create } from 'zustand'
import { temporal } from 'zundo'
import { cloneQuad, FULL_FRAME } from '../lib/homography'
import { attachedWing, normalizeVenue, type WallSide } from '../lib/wings'
import type {
  CorrectionEvent,
  DecorInstance,
  LightingPreset,
  PhotoAsset,
  PhotoPin,
  Space,
  SurfaceId,
  Vec2,
  Vec3,
  Venue,
  VenueMode,
  Wing,
} from '../types'

export type { LightingPreset }
export type CameraMode = 'orbit' | 'walk'

interface SceneState {
  /** A project is one or more independent spaces. See `Space` in types.ts. */
  spaces: Space[]
  activeSpaceId: string

  /** Shared across every space, so a prop cutout can be reused anywhere. */
  photos: PhotoAsset[]

  selectedItemId: string | null
  editingPinId: string | null
  /** Which wing the panel is editing. Null means the first one. */
  activeWingId: string | null
  cameraMode: CameraMode
  presenting: boolean

  /** Training data for the correction flywheel. Logged now, trained on later. */
  corrections: CorrectionEvent[]

  /**
   * Bumped whenever the viewed geometry is swapped wholesale — project load or
   * a space switch. The camera refits on change, so moving from a 26 ft
   * birthday room to a 52 ft banquet hall does not leave the user in a wall.
   */
  epoch: number

  setPresenting: (on: boolean) => void

  addSpace: (name?: string) => void
  removeSpace: (id: string) => void
  renameSpace: (id: string, name: string) => void
  setActiveSpace: (id: string) => void
  duplicateSpace: (id: string) => void

  setVenueMode: (mode: VenueMode) => void
  applyCalibration: (measured: number, actual: number) => void

  addWing: (side: WallSide) => void
  updateWing: (wingId: string, patch: Partial<Omit<Wing, 'id'>>) => void
  removeWing: (wingId: string) => void
  setActiveWing: (wingId: string | null) => void

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
  spaces: Space[]
  activeSpaceId: string
  photos: PhotoAsset[]
  corrections: CorrectionEvent[]
}

/** Roughly a 40 x 30 x 13 ft hall — a plausible mid-size banquet space. */
const defaultVenue = (): Venue => ({
  mode: 'indoor',
  wings: [
    { id: crypto.randomUUID(), name: 'Main', x: 0, z: 0, width: 12, depth: 9, height: 4 },
  ],
})

const uid = () => crypto.randomUUID()

function makeSpace(name: string, venue: Venue = defaultVenue()): Space {
  return {
    id: uid(),
    name,
    venue: normalizeVenue(venue),
    pins: [],
    items: [],
    calibrated: false,
    // Open bright: an empty room under the evening preset reads as a bug.
    lighting: 'day',
  }
}

const INDOOR_SURFACES: SurfaceId[] = ['floor', 'ceiling', 'north', 'south', 'east', 'west']
const OUTDOOR_KEPT: SurfaceId[] = ['floor', 'north']

export const useScene = create<SceneState>()(
  temporal(
    (set, get) => {
      /** Apply a patch to the active space, leaving every other space alone. */
      const patchActive = (fn: (space: Space) => Partial<Space>) =>
        set((s) => ({
          spaces: s.spaces.map((sp) => (sp.id === s.activeSpaceId ? { ...sp, ...fn(sp) } : sp)),
        }))

      const active = () => {
        const s = get()
        return s.spaces.find((sp) => sp.id === s.activeSpaceId) ?? s.spaces[0]
      }

      const first = makeSpace('Main hall')

      return {
        spaces: [first],
        activeSpaceId: first.id,
        photos: [],
        selectedItemId: null,
        editingPinId: null,
        activeWingId: null,
        cameraMode: 'orbit',
        presenting: false,
        corrections: [],
        epoch: 0,

        setPresenting: (on) => set({ presenting: on, selectedItemId: null }),

        addSpace: (name) =>
          set((s) => {
            const space = makeSpace(name ?? `Space ${s.spaces.length + 1}`)
            return {
              spaces: [...s.spaces, space],
              activeSpaceId: space.id,
              selectedItemId: null,
              editingPinId: null,
              epoch: s.epoch + 1,
            }
          }),

        removeSpace: (id) =>
          set((s) => {
            // A project always has at least one space; removing the last would
            // leave the editor with nothing to render.
            if (s.spaces.length <= 1) return s
            const spaces = s.spaces.filter((sp) => sp.id !== id)
            const activeSpaceId =
              s.activeSpaceId === id ? spaces[0].id : s.activeSpaceId
            return {
              spaces,
              activeSpaceId,
              selectedItemId: null,
              editingPinId: null,
              epoch: s.epoch + 1,
            }
          }),

        renameSpace: (id, name) =>
          set((s) => ({
            spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, name } : sp)),
          })),

        setActiveSpace: (id) =>
          set((s) =>
            s.activeSpaceId === id
              ? s
              : {
                  activeSpaceId: id,
                  selectedItemId: null,
                  editingPinId: null,
                  epoch: s.epoch + 1,
                },
          ),

        duplicateSpace: (id) =>
          set((s) => {
            const src = s.spaces.find((sp) => sp.id === id)
            if (!src) return s
            const copy: Space = {
              ...src,
              id: uid(),
              name: `${src.name} copy`,
              venue: { ...src.venue },
              // Deep-copy so editing the duplicate cannot mutate the original.
              pins: src.pins.map((p) => ({ ...p, id: uid(), corners: cloneQuad(p.corners) })),
              items: src.items.map((it) => ({
                ...it,
                id: uid(),
                position: [...it.position] as Vec3,
                params: { ...it.params },
              })),
            }
            return {
              spaces: [...s.spaces, copy],
              activeSpaceId: copy.id,
              selectedItemId: null,
              epoch: s.epoch + 1,
            }
          }),

        setVenueMode: (mode) =>
          patchActive((sp) => ({
            venue: { ...sp.venue, mode },
            // Outdoor keeps only the ground and backdrop; drop orphaned pins.
            pins: sp.pins.filter((p) =>
              (mode === 'outdoor' ? OUTDOOR_KEPT : INDOOR_SURFACES).includes(p.surface),
            ),
          })),

        addWing: (side) => {
          const sp = active()
          const host =
            sp.venue.wings.find((w) => w.id === get().activeWingId) ?? sp.venue.wings[0]
          if (!host) return
          // A new wing starts smaller than its host and matches its height, so
          // it reads as an extension rather than replacing the room.
          const wing = attachedWing(
            host,
            side,
            {
              width: side === 'west' || side === 'east' ? host.width * 0.6 : host.width * 0.7,
              depth: side === 'north' || side === 'south' ? host.depth * 0.6 : host.depth * 0.7,
              height: host.height,
            },
            `Wing ${sp.venue.wings.length + 1}`,
          )
          patchActive((space) => ({
            venue: { ...space.venue, wings: [...space.venue.wings, wing] },
          }))
          set({ activeWingId: wing.id })
        },

        updateWing: (wingId, patch) =>
          patchActive((sp) => ({
            venue: {
              ...sp.venue,
              wings: sp.venue.wings.map((w) => (w.id === wingId ? { ...w, ...patch } : w)),
            },
          })),

        removeWing: (wingId) => {
          const sp = active()
          // The venue must keep at least one wing or there is nothing to render.
          if (sp.venue.wings.length <= 1) return
          patchActive((space) => ({
            venue: {
              ...space.venue,
              wings: space.venue.wings.filter((w) => w.id !== wingId),
            },
            // Pins on the removed wing have nowhere left to live.
            pins: space.pins.filter((p) => (p.wingId ?? space.venue.wings[0]?.id) !== wingId),
          }))
          if (get().activeWingId === wingId) set({ activeWingId: null })
        },

        setActiveWing: (wingId) => set({ activeWingId: wingId }),

        applyCalibration: (measured, actual) => {
          if (measured <= 0 || actual <= 0) return
          const k = actual / measured
          patchActive((sp) => ({
            venue: {
              ...sp.venue,
              // Every wing scales together, so the venue keeps its shape.
              wings: sp.venue.wings.map((w) => ({
                ...w,
                x: w.x * k,
                z: w.z * k,
                width: w.width * k,
                depth: w.depth * k,
                height: w.height * k,
              })),
            },
            // Decor keeps its place in the room as the room rescales. Sizes are
            // deliberately untouched: they were authored in real feet already.
            items: sp.items.map((it) => ({
              ...it,
              position: it.position.map((v) => v * k) as Vec3,
            })),
            calibrated: true,
          }))
        },

        addPhoto: (photo) => set((s) => ({ photos: [...s.photos, photo] })),

        removePhoto: (photoId) =>
          set((s) => ({
            photos: s.photos.filter((p) => p.id !== photoId),
            // Pins referencing it must go from *every* space, not just this one.
            spaces: s.spaces.map((sp) => ({
              ...sp,
              pins: sp.pins.filter((p) => p.photoId !== photoId),
            })),
          })),

        pinPhoto: (photoId, surface) => {
          const id = uid()
          const wingId = get().activeWingId ?? active().venue.wings[0]?.id
          patchActive((sp) => ({
            // One photo per surface *of this wing*: replace rather than stack.
            pins: [
              ...sp.pins.filter(
                (p) =>
                  p.surface !== surface || (p.wingId ?? sp.venue.wings[0]?.id) !== wingId,
              ),
              {
                id,
                photoId,
                surface,
                wingId,
                corners: cloneQuad(FULL_FRAME),
                opacity: 1,
                visible: true,
                proposedBy: 'manual' as const,
              },
            ],
          }))
          set({ editingPinId: id })
        },

        updatePin: (pinId, patch) =>
          patchActive((sp) => ({
            pins: sp.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)),
          })),

        removePin: (pinId) => {
          patchActive((sp) => ({ pins: sp.pins.filter((p) => p.id !== pinId) }))
          if (get().editingPinId === pinId) set({ editingPinId: null })
        },

        setEditingPin: (pinId) => set({ editingPinId: pinId }),

        addItem: (type, position, params = {}) => {
          const id = uid()
          patchActive((sp) => ({
            items: [...sp.items, { id, type, position, rotationY: 0, params: { ...params } }],
          }))
          set({ selectedItemId: id })
        },

        updateItem: (id, patch) =>
          patchActive((sp) => ({
            items: sp.items.map((it) =>
              it.id === id
                ? { ...it, ...patch, params: { ...it.params, ...(patch.params ?? {}) } }
                : it,
            ),
          })),

        removeItem: (id) => {
          patchActive((sp) => ({ items: sp.items.filter((it) => it.id !== id) }))
          if (get().selectedItemId === id) set({ selectedItemId: null })
        },

        duplicateItem: (id) => {
          const src = active()?.items.find((it) => it.id === id)
          if (!src) return
          const copy: DecorInstance = {
            ...src,
            id: uid(),
            params: { ...src.params },
            position: [src.position[0] + 0.8, src.position[1], src.position[2]],
          }
          patchActive((sp) => ({ items: [...sp.items, copy] }))
          set({ selectedItemId: copy.id })
        },

        selectItem: (id) => set({ selectedItemId: id }),
        setLighting: (preset) => patchActive(() => ({ lighting: preset })),
        setCameraMode: (mode) => set({ cameraMode: mode, selectedItemId: null }),

        logCorrection: (event) => set((s) => ({ corrections: [...s.corrections, event] })),

        loadProject: (snapshot) =>
          set((s) => ({
            ...snapshot,
            // Projects saved before wings existed carry a flat
            // `{ width, depth, height }` venue; rebuild those as one wing.
            spaces: snapshot.spaces.map((sp) => ({
              ...sp,
              venue: normalizeVenue(sp.venue),
            })),
            selectedItemId: null,
            editingPinId: null,
            activeWingId: null,
            cameraMode: 'orbit',
            epoch: s.epoch + 1,
          })),

        reset: () => {
          const space = makeSpace('Main hall')
          set((s) => ({
            spaces: [space],
            activeSpaceId: space.id,
            photos: [],
            selectedItemId: null,
            editingPinId: null,
            activeWingId: null,
            corrections: [],
            epoch: s.epoch + 1,
          }))
        },
      }
    },
    {
      limit: 100,
      // Selection, camera, presentation and the append-only correction log are
      // not edits, so they are not tracked at all.
      partialize: (s) => ({
        spaces: s.spaces,
        activeSpaceId: s.activeSpaceId,
        photos: s.photos,
      }),
      /*
        Decides whether a change is worth an undo entry, by reference rather
        than by value — every mutation above is immutable, so an untouched
        `venue`/`pins`/`items` really is the same object. Deep-comparing would
        mean JSON-stringifying photos held as data URLs on every keystroke.

        Two things are deliberately excluded, both of which are navigation
        rather than editing: changing the lighting preset (a way of looking at
        the scene, not a change to it) and switching the active space.
      */
      equality: (a, b) =>
        a.photos === b.photos &&
        a.spaces.length === b.spaces.length &&
        a.spaces.every((sp, i) => {
          const other = b.spaces[i]
          return (
            other !== undefined &&
            sp.id === other.id &&
            sp.name === other.name &&
            sp.venue === other.venue &&
            sp.pins === other.pins &&
            sp.items === other.items &&
            sp.calibrated === other.calibrated
          )
        }),
    },
  ),
)

/**
 * Read a slice of the active space.
 *
 * Keeps call sites as short as the old flat store — `useActiveSpace(s => s.venue)`
 * — while the document underneath is a list of independent spaces.
 */
export function useActiveSpace<T>(selector: (space: Space) => T): T {
  return useScene((s) => selector(s.spaces.find((sp) => sp.id === s.activeSpaceId) ?? s.spaces[0]))
}

export function activeSpace(): Space {
  const s = useScene.getState()
  return s.spaces.find((sp) => sp.id === s.activeSpaceId) ?? s.spaces[0]
}

export function snapshot(): ProjectSnapshot {
  const s = useScene.getState()
  return {
    spaces: s.spaces,
    activeSpaceId: s.activeSpaceId,
    photos: s.photos,
    corrections: s.corrections,
  }
}

export type { Vec2 }
