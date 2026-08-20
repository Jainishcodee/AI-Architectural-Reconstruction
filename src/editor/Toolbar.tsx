import { useEffect, useRef, useState } from 'react'
import { LIGHTING } from '../scene/lighting'
import { useActiveSpace, useScene, type LightingPreset } from '../store/sceneStore'
import {
  exportCorrections,
  exportProjectFile,
  importProjectFile,
} from '../store/persistence'
import { TEMPLATES, templateSpace } from '../templates'
import { Button } from './ui'

const PRESETS = Object.keys(LIGHTING) as LightingPreset[]

export function Toolbar({
  onCalibrate,
  savedAt,
}: {
  onCalibrate: () => void
  savedAt: number | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const corrections = useScene((s) => s.corrections.length)
  const lighting = useActiveSpace((s) => s.lighting)
  const setLighting = useScene((s) => s.setLighting)
  const cameraMode = useScene((s) => s.cameraMode)
  const setCameraMode = useScene((s) => s.setCameraMode)
  const calibrated = useActiveSpace((s) => s.calibrated)
  const loadProject = useScene((s) => s.loadProject)
  const setPresenting = useScene((s) => s.setPresenting)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [undoState, setUndoState] = useState({ past: 0, future: 0 })

  // zundo's temporal store is separate from the main one, so subscribe directly.
  useEffect(() => {
    const sync = () => {
      const t = useScene.temporal.getState()
      setUndoState({ past: t.pastStates.length, future: t.futureStates.length })
    }
    sync()
    return useScene.temporal.subscribe(sync)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useScene.temporal.getState().redo()
        else useScene.temporal.getState().undo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useScene.getState().selectedItemId
        if (id) useScene.getState().removeItem(id)
      }
      if (e.key === 'Escape') useScene.getState().selectItem(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const exportPng = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    // preserveDrawingBuffer is on in Stage, so the buffer is still readable here.
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `vrcam-${Date.now()}.png`
    a.click()
  }

  /**
   * A template arrives as a new space rather than replacing the project — an
   * event spans several of them, and wiping a decorator's work to look at a
   * starter scene is unforgivable. The exception is a project the user has not
   * touched yet, where leaving an empty "Main hall" behind is just clutter.
   */
  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    const space = templateSpace(t)
    const s = useScene.getState()
    const untouched =
      s.spaces.length === 1 && s.spaces[0].items.length === 0 && s.spaces[0].pins.length === 0

    loadProject({
      spaces: untouched ? [space] : [...s.spaces, space],
      activeSpaceId: space.id,
      photos: s.photos,
      corrections: s.corrections,
    })
    setTemplatesOpen(false)
  }

  return (
    <header className="relative z-30 flex items-center gap-2 border-b border-[#262c36] bg-[#171b22] px-3 py-2">
      <span className="mr-1 text-sm font-semibold tracking-tight text-[#e8b04b]">VRcam</span>

      <div className="flex gap-1">
        <Button
          onClick={() => useScene.temporal.getState().undo()}
          disabled={undoState.past === 0}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </Button>
        <Button
          onClick={() => useScene.temporal.getState().redo()}
          disabled={undoState.future === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </Button>
      </div>

      <div className="mx-1 h-5 w-px bg-[#262c36]" />

      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <Button key={p} active={lighting === p} onClick={() => setLighting(p)}>
            {LIGHTING[p].label}
          </Button>
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-[#262c36]" />

      <Button
        active={cameraMode === 'walk'}
        onClick={() => setCameraMode(cameraMode === 'walk' ? 'orbit' : 'walk')}
        title="Walk through at eye height"
      >
        {cameraMode === 'walk' ? '🚶 Walking' : '🚶 Walk'}
      </Button>

      <div className="relative">
        <Button onClick={() => setTemplatesOpen((o) => !o)}>Templates ▾</Button>
        {templatesOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-lg border border-[#2c333f] bg-[#171b22] shadow-2xl">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className="block w-full border-b border-[#20252e] px-3 py-2 text-left last:border-0 hover:bg-[#212734]"
              >
                <span className="block text-xs font-medium text-[#e7eaf0]">{t.label}</span>
                <span className="block text-[10px] leading-snug text-[#7c8798]">{t.blurb}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {savedAt && (
          <span className="text-[10px] text-[#5f6875]" title="Saved locally in this browser">
            saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importProjectFile(f).catch((err) => alert(err.message))
            e.target.value = ''
          }}
        />
        <Button onClick={() => fileRef.current?.click()} title="Open a .json project">
          Open
        </Button>
        <Button onClick={exportProjectFile} title="Save the project to a file">
          Save file
        </Button>
        {corrections > 0 && (
          <Button
            onClick={exportCorrections}
            title={`Export ${corrections} alignment corrections as training data`}
          >
            ⤓ {corrections}
          </Button>
        )}
        <Button onClick={onCalibrate} tone={calibrated ? 'default' : 'primary'}>
          {calibrated ? '📐 Scale set' : '📐 Set real size'}
        </Button>
        <Button onClick={exportPng}>⬇ PNG</Button>
        <Button tone="primary" onClick={() => setPresenting(true)} title="Full-screen client view">
          ▶ Present
        </Button>
      </div>
    </header>
  )
}
