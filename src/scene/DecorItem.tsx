import { Suspense, useCallback, useRef } from 'react'
import { TransformControls } from '@react-three/drei'
import type { Group } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { DECOR_BY_ID } from '../decor/registry'
import { useScene } from '../store/sceneStore'
import type { DecorInstance, Vec3 } from '../types'

export type GizmoMode = 'translate' | 'rotate'

export function DecorItem({
  item,
  selected,
  mode,
}: {
  item: DecorInstance
  selected: boolean
  mode: GizmoMode
}) {
  const ref = useRef<Group>(null)
  const selectItem = useScene((s) => s.selectItem)
  const updateItem = useScene((s) => s.updateItem)
  const def = DECOR_BY_ID.get(item.type)

  const onClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      selectItem(item.id)
    },
    [item.id, selectItem],
  )

  /**
   * Written back only on mouse-up rather than on every gizmo frame: each write
   * is an undo entry, and a single drag would otherwise bury the history under
   * hundreds of them.
   */
  const commit = useCallback(() => {
    const g = ref.current
    if (!g) return
    updateItem(item.id, {
      position: [g.position.x, Math.max(0, g.position.y), g.position.z] as Vec3,
      rotationY: g.rotation.y,
    })
  }, [item.id, updateItem])

  if (!def) return null
  const Component = def.Component

  return (
    <>
      <group
        ref={ref}
        position={item.position}
        rotation={[0, item.rotationY, 0]}
        onClick={onClick}
      >
        <Suspense fallback={null}>
          <Component params={item.params} />
        </Suspense>
        {selected && <SelectionRing />}
      </group>
      {selected && (
        <TransformControls
          object={ref as React.RefObject<Group>}
          mode={mode}
          showY={mode === 'translate'}
          showX
          showZ
          size={0.8}
          rotationSnap={mode === 'rotate' ? Math.PI / 24 : undefined}
          onMouseUp={commit}
        />
      )}
    </>
  )
}

/** A floor disc under the selection, so it stays findable in a busy scene. */
function SelectionRing() {
  return (
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <ringGeometry args={[0.42, 0.5, 40]} />
      <meshBasicMaterial color="#e8b04b" transparent opacity={0.85} depthTest={false} />
    </mesh>
  )
}
