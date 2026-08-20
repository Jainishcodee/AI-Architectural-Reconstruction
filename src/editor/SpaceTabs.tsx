import { useEffect, useRef, useState } from 'react'
import { useScene } from '../store/sceneStore'

/**
 * The project's spaces, as tabs.
 *
 * This is the honest answer to "photos of the front, the back and inside".
 * Those views share no geometry and cannot be solved into one building, so they
 * are kept as separate scenes that share a photo pool and roll up into a single
 * quote — which is also how a decorator already thinks about a job.
 */
export function SpaceTabs() {
  const spaces = useScene((s) => s.spaces)
  const activeSpaceId = useScene((s) => s.activeSpaceId)
  const setActiveSpace = useScene((s) => s.setActiveSpace)
  const addSpace = useScene((s) => s.addSpace)
  const removeSpace = useScene((s) => s.removeSpace)
  const renameSpace = useScene((s) => s.renameSpace)
  const duplicateSpace = useScene((s) => s.duplicateSpace)

  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  return (
    <div className="flex items-center gap-1 border-b border-[#262c36] bg-[#12161d] px-3 py-1.5">
      <span className="mr-1 text-[10px] uppercase tracking-[0.14em] text-[#5f6875]">Spaces</span>

      {spaces.map((sp) => {
        const active = sp.id === activeSpaceId
        return (
          <div
            key={sp.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
              active
                ? 'bg-[#e8b04b] text-[#171b22]'
                : 'bg-[#1c222c] text-[#9aa4b2] hover:bg-[#242c38]'
            }`}
          >
            {editing === sp.id ? (
              <input
                ref={inputRef}
                defaultValue={sp.name}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) renameSpace(sp.id, v)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="w-24 bg-transparent text-xs outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setActiveSpace(sp.id)}
                onDoubleClick={() => setEditing(sp.id)}
                title="Double-click to rename"
                className="max-w-[160px] truncate"
              >
                {sp.name}
              </button>
            )}

            {active && (
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => duplicateSpace(sp.id)}
                  title="Duplicate this space"
                  className="rounded px-1 opacity-60 hover:opacity-100"
                >
                  ⧉
                </button>
                {spaces.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSpace(sp.id)}
                    title="Delete this space"
                    className="rounded px-1 opacity-60 hover:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </span>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => addSpace()}
        title="Add another space to this project"
        className="rounded-md bg-[#1c222c] px-2 py-1 text-xs text-[#9aa4b2] transition-colors hover:bg-[#242c38] hover:text-[#e8b04b]"
      >
        ＋
      </button>
    </div>
  )
}
