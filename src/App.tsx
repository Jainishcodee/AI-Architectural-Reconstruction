import { useEffect, useState } from 'react'
import { Stage } from './scene/Stage'
import { Toolbar } from './editor/Toolbar'
import { VenuePanel } from './editor/VenuePanel'
import { LibraryPanel } from './editor/LibraryPanel'
import { InspectorPanel } from './editor/InspectorPanel'
import { BomPanel } from './editor/BomPanel'
import { PhotoWarper } from './editor/PhotoWarper'
import { PresentBar } from './editor/PresentBar'
import { ScaleCalibrator } from './editor/ScaleCalibrator'
import { SpaceTabs } from './editor/SpaceTabs'
import { useScene } from './store/sceneStore'
import { loadProject, startAutosave } from './store/persistence'

export default function App() {
  const editingPinId = useScene((s) => s.editingPinId)
  const cameraMode = useScene((s) => s.cameraMode)
  const presenting = useScene((s) => s.presenting)
  const [calibrating, setCalibrating] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let stop: (() => void) | undefined
    void loadProject().then((project) => {
      if (project) useScene.getState().loadProject(project)
      // Autosave starts only after any restore, so an empty initial state can
      // never overwrite the saved project during boot.
      stop = startAutosave(setSavedAt)
      // The restore itself is not an undo step.
      useScene.temporal.getState().clear()
    })
    return () => stop?.()
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#0e1116]">
      {!presenting && (
        <>
          <Toolbar onCalibrate={() => setCalibrating(true)} savedAt={savedAt} />
          <SpaceTabs />
        </>
      )}

      <div className="relative flex min-h-0 flex-1">
        {!presenting && (
          <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-[#262c36] bg-[#171b22]">
            <VenuePanel />
            <LibraryPanel />
          </aside>
        )}

        <main className="relative min-w-0 flex-1">
          <Stage />
          {presenting && <PresentBar />}
          {cameraMode === 'walk' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <p className="rounded-full bg-black/70 px-4 py-2 text-xs text-[#c7cdd8]">
                Click to look around · <b>W A S D</b> to move · <b>Shift</b> to hurry ·{' '}
                <b>Esc</b> to come back
              </p>
            </div>
          )}
        </main>

        {!presenting && (
          <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[#262c36] bg-[#171b22]">
            <InspectorPanel />
            <BomPanel />
          </aside>
        )}

        {editingPinId && <PhotoWarper />}
        {calibrating && <ScaleCalibrator onClose={() => setCalibrating(false)} />}
      </div>
    </div>
  )
}
