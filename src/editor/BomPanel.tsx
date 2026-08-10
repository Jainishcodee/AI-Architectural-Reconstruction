import { useMemo, useState } from 'react'
import { DECOR_BY_ID } from '../decor/registry'
import { useScene } from '../store/sceneStore'
import { Button, Hint, Panel } from './ui'

interface Aggregated {
  label: string
  qty: number
  unit: string
  rate: number
}

const inr = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/**
 * Rolls every placed item's bill of materials into one costed list.
 *
 * This is what turns a pretty picture into something a newcomer can hand to a
 * client. The generators already know they placed 240 balloons, so the quantity
 * side is exact by construction — only the rates are guesses, which is why they
 * are editable.
 */
export function BomPanel() {
  const items = useScene((s) => s.items)
  const calibrated = useScene((s) => s.calibrated)
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({})
  const [margin, setMargin] = useState(30)

  const lines = useMemo<Aggregated[]>(() => {
    const acc = new Map<string, Aggregated>()
    for (const item of items) {
      const def = DECOR_BY_ID.get(item.type)
      if (!def) continue
      for (const line of def.bom(item.params)) {
        const key = `${line.label}|${line.unit}`
        const existing = acc.get(key)
        if (existing) existing.qty += line.qty
        else acc.set(key, { ...line })
      }
    }
    return [...acc.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [items])

  const rateFor = (l: Aggregated) => rateOverrides[`${l.label}|${l.unit}`] ?? l.rate
  const subtotal = lines.reduce((sum, l) => sum + Math.ceil(l.qty) * rateFor(l), 0)
  const total = subtotal * (1 + margin / 100)

  const copy = () => {
    const rows = lines.map(
      (l) => `${l.label}\t${Math.ceil(l.qty)} ${l.unit}\t${inr(rateFor(l))}\t${inr(Math.ceil(l.qty) * rateFor(l))}`,
    )
    const text = [
      'Item\tQty\tRate\tAmount',
      ...rows,
      '',
      `Subtotal\t\t\t${inr(subtotal)}`,
      `Margin (${margin}%)\t\t\t${inr(total - subtotal)}`,
      `Total\t\t\t${inr(total)}`,
    ].join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <Panel
      title="Bill of materials"
      actions={
        lines.length > 0 ? (
          <Button onClick={copy} title="Copy as a table for your quote">
            Copy
          </Button>
        ) : undefined
      }
    >
      {!calibrated && items.length > 0 && (
        <div className="mb-2">
          <Hint tone="warn">
            Scene is not calibrated, so every length below is a guess. Set one real
            measurement to make these quantities mean something.
          </Hint>
        </div>
      )}

      {lines.length === 0 ? (
        <Hint>Place some decor and the quantities and costs build themselves.</Hint>
      ) : (
        <>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#7c8798]">
                <th className="pb-1 font-medium">Item</th>
                <th className="pb-1 text-right font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Rate</th>
                <th className="pb-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const key = `${l.label}|${l.unit}`
                const rate = rateFor(l)
                return (
                  <tr key={key} className="border-t border-[#20252e]">
                    <td className="py-1 pr-1 text-[#c7cdd8]">{l.label}</td>
                    <td className="py-1 text-right tabular-nums text-[#9aa4b2]">
                      {Math.ceil(l.qty)} {l.unit}
                    </td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        value={rate}
                        min={0}
                        onChange={(e) =>
                          setRateOverrides((o) => ({ ...o, [key]: Number(e.target.value) }))
                        }
                        className="w-14 rounded border border-[#2c333f] bg-[#12161d] px-1 py-0.5 text-right tabular-nums text-[#e7eaf0] outline-none focus:border-[#e8b04b]"
                      />
                    </td>
                    <td className="py-1 text-right tabular-nums text-[#e7eaf0]">
                      {inr(Math.ceil(l.qty) * rate)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 border-t border-[#262c36] pt-2 text-[11px]">
            <div className="flex justify-between text-[#9aa4b2]">
              <span>Materials</span>
              <span className="tabular-nums">{inr(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[#9aa4b2]">
              <label className="flex items-center gap-1.5">
                Margin
                <input
                  type="number"
                  value={margin}
                  min={0}
                  max={200}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-12 rounded border border-[#2c333f] bg-[#12161d] px-1 py-0.5 text-right tabular-nums text-[#e7eaf0] outline-none focus:border-[#e8b04b]"
                />
                %
              </label>
              <span className="tabular-nums">{inr(total - subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-[#262c36] pt-1.5 text-sm font-semibold text-[#e8b04b]">
              <span>Quote</span>
              <span className="tabular-nums">{inr(total)}</span>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}
