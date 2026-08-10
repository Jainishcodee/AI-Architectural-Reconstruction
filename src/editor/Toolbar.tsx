import { useEffect, useState } from 'react'
import { LIGHTING } from '../scene/lighting'
import { useScene, type LightingPreset } from '../store/sceneStore'
import { TEMPLATES, instantiate } from '../templates'
import { Button } from './ui'

const PRESETS = Object.keys(LIGHTING) as LightingPreset[]

export function Toolbar({ onCalibrate }: { onCalibrate: () => void }) {
  const lighting = useScene((s) => s.lighting)
  const setLighting = useScene((s) => s.setLighting)
  const cameraMode = useScene((s) => s.cameraMode)
  const setCameraMode = useScene((s) => s.setCameraMode)
  const calibrated = useScene((s) => s.calibrated)
  const loadProject = useScene((s) => s.loadProject)
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

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    loadProject({
      venue: { ...t.venue },
      photos: [],
      pins: [],
      items: instantiate(t),
      // Templates ship with real-world dimensions already set.
      calibrated: true,
      lighting: t.id === 'haldi-lawn' ? 'day' : 'evening',
      corrections: [],
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
        <Button onClick={onCalibrate} tone={calibrated ? 'default' : 'primary'}>
          {calibrated ? '📐 Scale set' : '📐 Set real size'}
        </Button>
        <Button onClick={exportPng}>⬇ PNG</Button>
      </div>
    </header>
  )
}
