import { get, set, del } from 'idb-keyval'
import { snapshot, useScene, type ProjectSnapshot } from './sceneStore'

const KEY = 'vrcam:project'
const VERSION = 1

interface Stored {
  version: number
  savedAt: number
  project: ProjectSnapshot
}

/**
 * Local-first autosave.
 *
 * IndexedDB rather than localStorage because venue photos are stored inline as
 * data URLs and blow past the ~5 MB localStorage ceiling with about three
 * pictures. No account, no network — the tool has to work on a laptop in a
 * decorator's shop with no wifi.
 */
export async function loadProject(): Promise<ProjectSnapshot | null> {
  try {
    const stored = await get<Stored>(KEY)
    if (!stored || stored.version !== VERSION) return null
    return stored.project
  } catch {
    return null
  }
}

export async function saveProject(): Promise<void> {
  const stored: Stored = { version: VERSION, savedAt: Date.now(), project: snapshot() }
  await set(KEY, stored)
}

export async function clearProject(): Promise<void> {
  await del(KEY)
}

/**
 * Autosave on any document change, trailing-debounced.
 *
 * Writes are skipped while a gizmo drag is in flight — dragging fires dozens of
 * store updates a second, and serialising a scene with embedded photos on each
 * one would stall the frame loop.
 */
export function startAutosave(onSaved?: (at: number) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = ''

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const s = useScene.getState()
      // Cheap dirty-check that ignores selection and camera churn. Photos are
      // compared by id, never by content — they are data URLs, and stringifying
      // them on every store update would stall the frame loop.
      const fingerprint = JSON.stringify({
        sp: s.spaces.map((x) => ({
          id: x.id,
          n: x.name,
          v: x.venue,
          p: x.pins,
          i: x.items,
          c: x.calibrated,
          l: x.lighting,
        })),
        a: s.activeSpaceId,
        ph: s.photos.map((x) => x.id),
        k: s.corrections.length,
      })
      if (fingerprint === last) return
      last = fingerprint
      void saveProject().then(() => onSaved?.(Date.now()))
    }, 900)
  }

  schedule()
  return useScene.subscribe(schedule)
}

export function exportProjectFile() {
  const data: Stored = { version: VERSION, savedAt: Date.now(), project: snapshot() }
  download(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
    `vrcam-project-${new Date().toISOString().slice(0, 10)}.json`,
  )
}

export async function importProjectFile(file: File): Promise<void> {
  const text = await file.text()
  const parsed = JSON.parse(text) as Stored
  if (!parsed?.project?.spaces?.length) throw new Error('That file is not a VRcam project.')
  useScene.getState().loadProject({
    ...parsed.project,
    corrections: parsed.project.corrections ?? [],
  })
}

/**
 * The correction log, as training data.
 *
 * Exportable from day one even though there is no model to train yet: this is
 * the one thing that cannot be collected retroactively, and it is the asset that
 * compounds. See the plan's correction-flywheel section.
 */
export function exportCorrections() {
  const { corrections } = useScene.getState()
  const jsonl = corrections.map((c) => JSON.stringify(c)).join('\n')
  download(new Blob([jsonl], { type: 'application/jsonl' }), `vrcam-corrections-${Date.now()}.jsonl`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
