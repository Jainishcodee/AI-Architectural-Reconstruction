import { DECOR_BY_ID } from '../decor/registry'
import { useGizmo } from '../scene/DecorLayer'
import { useScene } from '../store/sceneStore'
import { Button, ColorField, Hint, NumberField, Panel, SelectField, Slider } from './ui'

export function InspectorPanel() {
  const selectedItemId = useScene((s) => s.selectedItemId)
  const item = useScene((s) => s.items.find((i) => i.id === selectedItemId))
  const photos = useScene((s) => s.photos)
  const updateItem = useScene((s) => s.updateItem)
  const removeItem = useScene((s) => s.removeItem)
  const duplicateItem = useScene((s) => s.duplicateItem)
  const mode = useGizmo((s) => s.mode)
  const setMode = useGizmo((s) => s.setMode)

  if (!item) {
    return (
      <Panel title="Selection">
        <Hint>Click any decor piece in the scene to adjust it.</Hint>
      </Panel>
    )
  }

  const def = DECOR_BY_ID.get(item.type)
  if (!def) return null

  return (
    <Panel
      title={def.label}
      actions={
        <div className="flex gap-1">
          <Button onClick={() => duplicateItem(item.id)} title="Duplicate">
            ⧉
          </Button>
          <Button tone="danger" onClick={() => removeItem(item.id)} title="Delete">
            ✕
          </Button>
        </div>
      }
    >
      <div className="mb-2.5 flex gap-1">
        <Button active={mode === 'translate'} onClick={() => setMode('translate')}>
          Move
        </Button>
        <Button active={mode === 'rotate'} onClick={() => setMode('rotate')}>
          Rotate
        </Button>
      </div>

      {def.params.map((p) => {
        if (p.type === 'number') {
          return (
            <Slider
              key={p.key}
              label={p.label}
              value={Number(item.params[p.key] ?? p.default)}
              min={p.min}
              max={p.max}
              step={p.step}
              unit={p.unit}
              onChange={(v) => updateItem(item.id, { params: { [p.key]: v } })}
            />
          )
        }
        if (p.type === 'color') {
          return (
            <ColorField
              key={p.key}
              label={p.label}
              value={String(item.params[p.key] ?? p.default)}
              onChange={(v) => updateItem(item.id, { params: { [p.key]: v } })}
            />
          )
        }
        // The cutout's photo list is populated at render time from the project.
        const options =
          p.key === 'photoId'
            ? photos.map((ph) => ({ value: ph.id, label: ph.name }))
            : p.options
        return (
          <SelectField
            key={p.key}
            label={p.label}
            value={String(item.params[p.key] ?? p.default)}
            options={options}
            onChange={(v) => updateItem(item.id, { params: { [p.key]: v } })}
          />
        )
      })}

      <div className="mt-3 border-t border-[#262c36] pt-2">
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="X"
            unit="ft"
            value={item.position[0]}
            min={-100}
            onChange={(v) => updateItem(item.id, { position: [v, item.position[1], item.position[2]] })}
          />
          <NumberField
            label="Height"
            unit="ft"
            value={item.position[1]}
            onChange={(v) => updateItem(item.id, { position: [item.position[0], v, item.position[2]] })}
          />
          <NumberField
            label="Z"
            unit="ft"
            value={item.position[2]}
            min={-100}
            onChange={(v) => updateItem(item.id, { position: [item.position[0], item.position[1], v] })}
          />
        </div>
      </div>
    </Panel>
  )
}
