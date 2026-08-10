import { useRef, useState } from 'react'
import { useScene } from '../store/sceneStore'
import { surfacesFor } from '../lib/surfaces'
import { readFileAsDataUrl, loadImage } from '../lib/removeBg'
import { SURFACE_LABELS, type SurfaceId } from '../types'
import { Button, Hint, NumberField, Panel, SelectField } from './ui'

export function VenuePanel() {
  const venue = useScene((s) => s.venue)
  const photos = useScene((s) => s.photos)
  const pins = useScene((s) => s.pins)
  const setVenueMode = useScene((s) => s.setVenueMode)
  const setVenueSize = useScene((s) => s.setVenueSize)
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
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Width"
            unit="ft"
            value={venue.width}
            onChange={(v) => setVenueSize({ width: Math.max(2, v) })}
          />
          <NumberField
            label="Depth"
            unit="ft"
            value={venue.depth}
            onChange={(v) => setVenueSize({ depth: Math.max(2, v) })}
          />
          {venue.mode === 'indoor' && (
            <NumberField
              label="Height"
              unit="ft"
              value={venue.height}
              onChange={(v) => setVenueSize({ height: Math.max(2, v) })}
            />
          )}
        </div>
        <Hint>Drag the gold nubs in the 3D view to resize the room by eye.</Hint>
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
