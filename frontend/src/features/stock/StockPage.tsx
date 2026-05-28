import { useState } from 'react'
import { useStock, useAddStockItem, useAdjustStock, type StockItem } from './useStock'

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function AddMaterialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddStockItem()
  const [form, setForm] = useState({ name: '', category: 'Paper', quantity: 0, minLevel: 0, unit: 'Reams' })
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={e => { e.preventDefault(); add.mutate(form, { onSuccess: () => onClose() }) }} className="bg-white rounded-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold mb-3">Add material</h2>
        <div className="space-y-3 text-sm">
          <div><label className="block text-xs text-gray-600 mb-1">Name</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Category</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option>Paper</option><option>Vinyl</option><option>Ink</option><option>Laminate</option><option>Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-600 mb-1">On hand</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div><label className="block text-xs text-gray-600 mb-1">Min level</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.minLevel} onChange={e => setForm(f => ({ ...f, minLevel: Number(e.target.value) }))} />
            </div>
          </div>
          <div><label className="block text-xs text-gray-600 mb-1">Unit</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              <option>Reams</option><option>Sheets</option><option>Rolls</option><option>Litres</option><option>Boxes</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button disabled={add.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">{add.isPending ? 'Saving…' : 'Add'}</button>
        </div>
      </form>
    </div>
  )
}

function AdjustQty({ item }: { item: StockItem }) {
  const adjust = useAdjustStock()
  const [qty, setQty] = useState(item.quantity)
  return (
    <div className="flex gap-1">
      <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-16 border border-gray-200 rounded px-2 py-1 text-xs" />
      <button onClick={() => adjust.mutate({ id: item.id, quantity: qty })} className="text-xs px-2 py-1 bg-brand text-white rounded">Save</button>
    </div>
  )
}

function statusFor(s: StockItem) {
  if (s.quantity === 0) return { label: 'Out of stock', tone: 'bg-red-100 text-red-700' }
  if (s.quantity <= s.minLevel) return { label: 'Low stock', tone: 'bg-amber-100 text-amber-700' }
  return { label: 'In stock', tone: 'bg-green-100 text-green-700' }
}

export default function StockPage() {
  const { data: stock = [], isLoading } = useStock()
  const [showAdd, setShowAdd] = useState(false)

  const inStock = stock.filter(s => s.quantity > s.minLevel).length
  const low = stock.filter(s => s.quantity > 0 && s.quantity <= s.minLevel).length
  const out = stock.filter(s => s.quantity === 0).length

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Stock & materials</h1>
        <button onClick={() => setShowAdd(true)} className="bg-brand text-white text-sm px-4 py-2 rounded-lg">+ Add material</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Metric label="In stock" value={inStock} tone="bg-green-50 border-green-100 text-green-900" />
        <Metric label="Low stock" value={low} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Out of stock" value={out} tone="bg-red-50 border-red-100 text-red-900" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-4 space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div> :
          stock.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">No materials yet</div> :
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Material', 'Category', 'On hand', 'Min', 'Unit', 'Level', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}
              </tr></thead>
              <tbody>
                {stock.map(s => {
                  const status = statusFor(s)
                  const pct = s.minLevel > 0 ? Math.min(100, Math.round((s.quantity / (s.minLevel * 2)) * 100)) : 100
                  const colour = s.quantity === 0 ? 'bg-red-500' : s.quantity <= s.minLevel ? 'bg-amber-500' : 'bg-green-500'
                  return (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s.category}</span></td>
                      <td className="px-4 py-3">{s.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{s.minLevel}</td>
                      <td className="px-4 py-3 text-xs">{s.unit}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                          <div className={colour} style={{ width: `${pct}%`, height: '100%' }} />
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span></td>
                      <td className="px-4 py-3"><AdjustQty item={s} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        }
      </div>

      <AddMaterialModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
