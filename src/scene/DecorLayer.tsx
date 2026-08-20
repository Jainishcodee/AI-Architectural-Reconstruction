import { useActiveSpace, useScene } from '../store/sceneStore'
import { DecorItem, type GizmoMode } from './DecorItem'
import { create } from 'zustand'

/**
 * Gizmo mode lives outside the scene store because it is a transient tool
 * setting, not part of the document — putting it in the document would make it
 * undoable, which is not what anyone expects from a toolbar toggle.
 */
export const useGizmo = create<{ mode: GizmoMode; setMode: (m: GizmoMode) => void }>((set) => ({
  mode: 'translate',
  setMode: (mode) => set({ mode }),
}))

export function DecorLayer() {
  const items = useActiveSpace((s) => s.items)
  const selectedItemId = useScene((s) => s.selectedItemId)
  const cameraMode = useScene((s) => s.cameraMode)
  const presenting = useScene((s) => s.presenting)
  const mode = useGizmo((s) => s.mode)

  return (
    <group>
      {items.map((item) => (
        <DecorItem
          key={item.id}
          item={item}
          // Gizmos are meaningless in walk mode, block the view, and have no
          // business being visible while a client is looking at the scene.
          selected={cameraMode === 'orbit' && !presenting && item.id === selectedItemId}
          mode={mode}
        />
      ))}
    </group>
  )
}
