import { Fragment, useState } from 'react'
import { useCustomers, useCustomer, useCreateCustomer } from './useCustomers'
import { fmtCurrency, fmtDate, initials } from '@/lib/formatters'
import { useAuthStore } from '@/features/auth/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const typeBadge: Record<string, string> = {
  INDIVIDUAL: 'bg-gray-100 text-gray-600',
  BUSINESS: 'bg-blue-100 text-blue-700',
  CORPORATE: 'bg-purple-100 text-purple-700',
}

function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateCustomer()
  const currentStaffId = useAuthStore(s => s.currentStaffId)
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: () => api.get('/api/auth/staff').then(r => r.data) })
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', type: 'INDIVIDUAL', capturedById: currentStaffId || '' })
  const [errs, setErrs] = useState<Record<string, string>>({})

  if (!open) return null

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Required'
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Valid email required'
    if (!form.phone.trim()) errors.phone = 'Required'
    setErrs(errors)
    if (Object.keys(errors).length) return
    const { capturedById, ...payload } = form
    create.mutate({ ...payload, type: form.type as any }, { onSuccess: () => onClose() })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">Add customer</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Name / Company *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.name} onChange={e => set('name', e.target.value)} />
            {errs.name && <span className="text-xs text-red-600">{errs.name}</span>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Contact person</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.email} onChange={e => set('email', e.target.value)} />
              {errs.email && <span className="text-xs text-red-600">{errs.email}</span>}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Phone *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.phone} onChange={e => set('phone', e.target.value)} />
              {errs.phone && <span className="text-xs text-red-600">{errs.phone}</span>}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Address</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="BUSINESS">Business</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Captured by</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.capturedById} onChange={e => set('capturedById', e.target.value)}>
                <option value="">—</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button disabled={create.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CustomerHistory({ id }: { id: string }) {
  const { data, isLoading } = useCustomer(id)
  if (isLoading) return <div className="text-xs text-gray-400 py-3 px-4">Loading…</div>
  if (!data) return null
  const totalSpent = (data.invoices ?? []).reduce((s, i) => s + Number(i.amountPaid), 0)
  return (
    <div className="p-4 bg-gray-50 border-t border-gray-100">
      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
        <div><div className="text-xs text-gray-500">Total spent</div><div className="font-semibold">{fmtCurrency(totalSpent)}</div></div>
        <div><div className="text-xs text-gray-500">Orders</div><div className="font-semibold">{data.orders?.length ?? 0}</div></div>
        <div><div className="text-xs text-gray-500">Address</div><div className="text-xs">{data.address || '—'}</div></div>
      </div>
      <h4 className="text-xs font-semibold text-gray-500 mb-1">Recent orders</h4>
      {(data.orders ?? []).length === 0 ? (
        <div className="text-xs text-gray-400">No orders yet</div>
      ) : (
        <div className="space-y-1">
          {(data.orders ?? []).slice(0, 5).map((o: any) => (
            <div key={o.id} className="flex justify-between text-xs py-1">
              <span>{o.orderNumber} · {o.jobName}</span>
              <span className="text-gray-500">{fmtCurrency(o.totalValue)} · {fmtDate(o.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: customers = [], isLoading } = useCustomers()

  const filtered = customers.filter(c => !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Customers</h1>
        <button onClick={() => setShowAdd(true)} className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark">+ Add customer</button>
      </div>

      <input
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-sm mb-4"
        placeholder="Search by name or email…"
        value={search} onChange={e => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No customers — click "Add customer" to create one</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Contact', 'Email', 'Phone', 'Orders', 'Spent'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <Fragment key={c.id}>
                  <tr onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-light text-brand text-xs font-semibold flex items-center justify-center">{initials(c.name)}</div>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${typeBadge[c.type]}`}>{c.type.toLowerCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.contactPerson || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                    <td className="px-4 py-3">{c._count?.orders ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">—</td>
                  </tr>
                  {expandedId === c.id && (
                    <tr><td colSpan={6} className="p-0"><CustomerHistory id={c.id} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}
