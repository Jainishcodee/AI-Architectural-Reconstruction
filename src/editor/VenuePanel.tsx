import { useRef, useState } from 'react'
import { useActiveSpace, useScene } from '../store/sceneStore'
import { surfacesFor } from '../lib/surfaces'
import { overlapsAny } from '../lib/wings'
import { readFileAsDataUrl, loadImage } from '../lib/removeBg'
import { SURFACE_LABELS, type SurfaceId } from '../types'
import { Button, Hint, NumberField, Panel, SelectField } from './ui'

/**
 * One direction of a compass pad.
 *
 * Laid out spatially rather than as a list: a two-column list of the four
 * directions puts "to the left" physically on the right of "to the right",
 * which is exactly the sort of thing a user has to stop and decode.
 */
function ExtendButton({
  arrow,
  hint,
  onClick,
}: {
  arrow: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={`Extend ${hint}`}
      onClick={onClick}
      className="flex h-10 flex-col items-center justify-center rounded-md bg-[#222833] text-[#c7cdd8] transition-colors hover:bg-[#e8b04b] hover:text-[#171b22]"
    >
      <span className="text-sm leading-none">{arrow}</span>
      <span className="mt-0.5 text-[8px] uppercase leading-none tracking-wide opacity-70">
        {hint}
      </span>
    </button>
  )
}

export function VenuePanel() {
  const venue = useActiveSpace((s) => s.venue)
  const photos = useScene((s) => s.photos)
  const pins = useActiveSpace((s) => s.pins)
  const setVenueMode = useScene((s) => s.setVenueMode)
  const activeWingId = useScene((s) => s.activeWingId)
  const setActiveWing = useScene((s) => s.setActiveWing)
  const updateWing = useScene((s) => s.updateWing)
  const addWing = useScene((s) => s.addWing)
  const removeWing = useScene((s) => s.removeWing)
  const addPhoto = useScene((s) => s.addPhoto)
  const removePhoto = useScene((s) => s.removePhoto)
  const pinPhoto = useScene((s) => s.pinPhoto)
  const setEditingPin = useScene((s) => s.setEditingPin)
  const removePin = useScene((s) => s.removePin)

  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const src = await readFileAsDataUrl(file)
        const img = await loadImage(src)
        const id = crypto.randomUUID()
        addPhoto({ id, name: file.name, src, width: img.width, height: img.height })
        setSelectedPhoto((cur) => cur ?? id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read those files')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const surfaces = surfacesFor(venue)
  const wing = venue.wings.find((w) => w.id === activeWingId) ?? venue.wings[0]
  // Two wings sharing floor area produce z-fighting and an undefined opening,
  // so it is called out rather than silently rendered wrong.
  const overlapping = wing ? overlapsAny(venue, wing) : false

  return (
    <>
      <Panel title="Venue">
        <SelectField
          label="Type"
          value={venue.mode}
          options={[
            { value: 'indoor', label: 'Indoor — hall / banquet' },
            { value: 'outdoor', label: 'Outdoor — lawn / farmhouse' },
          ]}
          onChange={(v) => setVenueMode(v as 'indoor' | 'outdoor')}
        />

        {venue.wings.length > 1 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {venue.wings.map((w) => (
              <Button
                key={w.id}
                active={w.id === wing?.id}
                onClick={() => setActiveWing(w.id)}
              >
                {w.name}
              </Button>
            ))}
          </div>
        )}

        {wing && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Width"
                unit="ft"
                value={wing.width}
                onChange={(v) => updateWing(wing.id, { width: Math.max(1.5, v) })}
              />
              <NumberField
                label="Depth"
                unit="ft"
                value={wing.depth}
                onChange={(v) => updateWing(wing.id, { depth: Math.max(1.5, v) })}
              />
              {venue.mode === 'indoor' && (
                <NumberField
                  label="Height"
                  unit="ft"
                  value={wing.height}
                  onChange={(v) => updateWing(wing.id, { height: Math.max(1.5, v) })}
                />
              )}
            </div>

            {venue.wings.length > 1 && (
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Offset X"
                  unit="ft"
                  min={-200}
                  value={wing.x}
                  onChange={(v) => updateWing(wing.id, { x: v })}
                />
                <NumberField
                  label="Offset Z"
                  unit="ft"
                  min={-200}
                  value={wing.z}
                  onChange={(v) => updateWing(wing.id, { z: v })}
                />
              </div>
            )}
          </>
        )}

        <Hint>Drag the gold nubs in the 3D view to push a wall in or out.</Hint>

        {venue.mode === 'indoor' && wing && (
          <div className="mt-3 border-t border-[#262c36] pt-3">
            <p className="mb-1.5 text-[11px] text-[#9aa4b2]">
              Extend {venue.wings.length > 1 ? wing.name.toLowerCase() : 'the room'}. The
              new area meets the wall edge to edge and the shared wall opens by itself;
              drag a nub afterwards to pull one end in for an L.
            </p>
            <div className="mx-auto grid w-[168px] grid-cols-3 gap-1">
              <span />
              <ExtendButton arrow="↑" hint="back" onClick={() => addWing('north')} />
              <span />
              <ExtendButton arrow="←" hint="left" onClick={() => addWing('west')} />
              <div className="flex items-center justify-center rounded-md border border-dashed border-[#3a4250] text-[8px] uppercase tracking-wide text-[#5f6875]">
                room
              </div>
              <ExtendButton arrow="→" hint="right" onClick={() => addWing('east')} />
              <span />
              <ExtendButton arrow="↓" hint="front" onClick={() => addWing('south')} />
              <span />
            </div>
            {venue.wings.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <Button tone="danger" onClick={() => removeWing(wing.id)}>
                  Remove {wing.name.toLowerCase()}
                </Button>
              </div>
            )}
            {overlapping && (
              <p className="mt-2 text-[11px] text-[#f0a0a8]">
                {wing.name} overlaps another area — nudge its offset until they only
                touch, or the shared wall cannot be worked out.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Photos"
        actions={
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Reading…' : '+ Add'}
          </Button>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />

        {photos.length === 0 ? (
          <Hint>
            Add a few shots of the venue — one per wall is plenty. They become the
            backdrop you place decor against.
          </Hint>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p) => {
              const pinnedTo = pins.find((pin) => pin.photoId === p.id)
              const active = selectedPhoto === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPhoto(p.id)}
                  className={`group relative aspect-4/3 overflow-hidden rounded-md border-2 transition ${
                    active ? 'border-[#e8b04b]' : 'border-transparent hover:border-[#3a4250]'
                  }`}
                >
                  <img src={p.src} alt={p.name} className="h-full w-full object-cover" />
                  {pinnedTo && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[9px] text-[#e8b04b]">
                      {SURFACE_LABELS[pinnedTo.surface]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-[#f0a0a8]">{error}</p>}

        {selectedPhoto && (
          <div className="mt-3 border-t border-[#262c36] pt-3">
            <p className="mb-1.5 text-[11px] text-[#9aa4b2]">Pin this photo to…</p>
            <div className="grid grid-cols-2 gap-1.5">
              {surfaces.map((s) => (
                <Button key={s} onClick={() => pinPhoto(selectedPhoto, s)}>
                  {SURFACE_LABELS[s as SurfaceId]}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button
                tone="danger"
                onClick={() => {
                  removePhoto(selectedPhoto)
                  setSelectedPhoto(null)
                }}
              >
                Remove photo
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {pins.length > 0 && (
        <Panel title="Pinned surfaces">
          <ul className="space-y-1.5">
            {pins.map((pin) => {
              const photo = photos.find((p) => p.id === pin.photoId)
              return (
                <li
                  key={pin.id}
                  className="flex items-center gap-2 rounded-md bg-[#12161d] p-1.5"
                >
                  {photo && (
                    <img
                      src={photo.src}
                      alt=""
                      className="h-8 w-11 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="flex-1 truncate text-[11px] text-[#c7cdd8]">
                    {SURFACE_LABELS[pin.surface]}
                  </span>
                  <Button onClick={() => setEditingPin(pin.id)}>Align</Button>
                  <Button tone="danger" onClick={() => removePin(pin.id)}>
                    ✕
                  </Button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </>
  )
}
