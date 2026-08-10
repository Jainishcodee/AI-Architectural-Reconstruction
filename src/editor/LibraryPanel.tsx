import { useRef, useState } from 'react'
import { CATEGORY_LABELS, DECOR, defaultParams, type Category, type DecorDef } from '../decor/registry'
import { useScene } from '../store/sceneStore'
import { readFileAsDataUrl, loadImage, removeBackground } from '../lib/removeBg'
import { Button, Hint, Panel } from './ui'
import type { Vec3 } from '../types'

const ORDER: Category[] = ['balloons', 'florals', 'structures', 'fabric', 'lighting', 'furniture', 'custom']

export function LibraryPanel() {
  const venue = useScene((s) => s.venue)
  const items = useScene((s) => s.items)
  const addItem = useScene((s) => s.addItem)
  const addPhoto = useScene((s) => s.addPhoto)
  const [open, setOpen] = useState<Category>('balloons')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /** Fan new items out from the centre so they never land inside each other. */
  const spawn = (def: DecorDef): Vec3 => {
    const n = items.length
    const ring = 0.9 + Math.floor(n / 6) * 1.1
    const ang = (n % 6) * (Math.PI / 3)
    const x = Math.cos(ang) * ring
    const z = Math.sin(ang) * ring
    if (def.mount === 'ceiling') return [x, venue.height * 0.82, z]
    if (def.mount === 'wall') return [x, 0, -venue.depth / 2 + 0.12]
    return [x, 0, z]
  }

  const onUploadProp = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      const file = files[0]
      const raw = await readFileAsDataUrl(file)
      const cut = await removeBackground(raw)
      const img = await loadImage(cut.url)
      const id = crypto.randomUUID()
      addPhoto({ id, name: `cutout: ${file.name}`, src: cut.url, width: img.width, height: img.height })
      const def = DECOR.find((d) => d.id === 'billboard')!
      addItem('billboard', spawn(def), { ...defaultParams(def), photoId: id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that image')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Panel title="Decor library">
      <div className="mb-2 flex flex-wrap gap-1">
        {ORDER.map((c) => (
          <Button key={c} active={open === c} onClick={() => setOpen(c)}>
            {CATEGORY_LABELS[c]}
          </Button>
        ))}
      </div>

      {open === 'custom' ? (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onUploadProp(e.target.files)}
          />
          <Button full tone="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Cutting out…' : '＋ Upload a prop photo'}
          </Button>
          <Hint>
            Shoot the prop against a plain wall. The background is removed and it drops in as a
            standing cutout — good enough to sell the look, and free.
          </Hint>
          {error && <p className="text-[11px] text-[#f0a0a8]">{error}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {DECOR.filter((d) => d.category === open).map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => addItem(def.id, spawn(def), defaultParams(def))}
              className="flex flex-col items-start gap-1 rounded-lg border border-[#262c36] bg-[#12161d] p-2 text-left transition hover:border-[#e8b04b] hover:bg-[#1a1f28]"
            >
              <span className="text-lg leading-none">{def.icon}</span>
              <span className="text-[11px] leading-tight text-[#c7cdd8]">{def.label}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}
