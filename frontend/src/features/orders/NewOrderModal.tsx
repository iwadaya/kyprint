import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/features/auth/authStore'
import { useCreateOrder, useGenerateInvoice } from './useOrders'
import { fmtCurrency, calcVAT } from '@/lib/formatters'

type PaymentArrangement = 'FULL' | 'DEPOSIT_PCT' | 'DEPOSIT_FIXED' | 'COD'

const JOB_TYPES = ['Business cards', 'Flyers', 'Brochures', 'Posters', 'Banners', 'Labels', 'Booklets', 'Stationery', 'Vinyl signage', 'Other']

export default function NewOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (orderId: string) => void }) {
  const currentStaffId = useAuthStore(s => s.currentStaffId)
  const create = useCreateOrder()
  const genInvoice = useGenerateInvoice()
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ['customers'], queryFn: () => api.get('/api/customers').then(r => r.data), enabled: open })
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: () => api.get('/api/auth/staff').then(r => r.data), enabled: open })

  const [form, setForm] = useState({
    capturedById: currentStaffId || '',
    customerId: '',
    jobName: '',
    jobType: 'Business cards',
    quantity: 100,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: 'MEDIUM',
    totalValue: 0,
    paymentType: 'FULL' as PaymentArrangement,
    depositPct: 50,
    depositFixed: 0,
    depositReceived: false,
    notes: '',
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }

  const depositAmount = useMemo(() => {
    if (form.paymentType === 'DEPOSIT_PCT') return Math.round((form.totalValue * form.depositPct) / 100)
    if (form.paymentType === 'DEPOSIT_FIXED') return form.depositFixed
    return 0
  }, [form.paymentType, form.totalValue, form.depositPct, form.depositFixed])

  const balance = Math.max(0, form.totalValue - depositAmount)
  const vat = calcVAT(form.totalValue)
  const depPct = form.totalValue > 0 ? Math.min(100, Math.round((depositAmount / form.totalValue) * 100)) : 0

  const filteredCustomers = customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()))

  function validate() {
    const e: Record<string, string> = {}
    if (!form.capturedById) e.capturedById = 'Required'
    if (!form.customerId) e.customerId = 'Required'
    if (!form.jobName.trim()) e.jobName = 'Required'
    if (form.quantity <= 0) e.quantity = 'Must be > 0'
    if (form.totalValue <= 0) e.totalValue = 'Required'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function save(thenInvoice = false) {
    if (!validate()) return
    const payload = {
      capturedById: form.capturedById,
      customerId: form.customerId,
      jobName: form.jobName,
      jobType: form.jobType,
      quantity: form.quantity,
      dueDate: new Date(form.dueDate).toISOString(),
      priority: form.priority,
      totalValue: form.totalValue,
      paymentType: form.paymentType,
      depositPct: form.paymentType === 'DEPOSIT_PCT' ? form.depositPct : 0,
      depositFixed: form.paymentType === 'DEPOSIT_FIXED' ? form.depositFixed : 0,
      depositAmount,
      depositReceived: form.depositReceived,
      notes: form.notes,
    }
    try {
      const created = await create.mutateAsync(payload)
      if (thenInvoice) {
        await genInvoice.mutateAsync(created.id)
        toast.success('Order + invoice created')
      }
      onCreated?.(created.id)
      onClose()
    } catch {
      // toast handled in hook
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-3">New order</h2>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Captured by *</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.capturedById} onChange={e => set('capturedById', e.target.value)}>
              <option value="">—</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errs.capturedById && <span className="text-xs text-red-600">{errs.capturedById}</span>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Customer *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 mb-1" placeholder="Search…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.customerId} onChange={e => set('customerId', e.target.value)}>
              <option value="">— Select customer —</option>
              {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errs.customerId && <span className="text-xs text-red-600">{errs.customerId}</span>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Job name *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.jobName} onChange={e => set('jobName', e.target.value)} placeholder="e.g. Q3 marketing flyers" />
            {errs.jobName && <span className="text-xs text-red-600">{errs.jobName}</span>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Job type</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.jobType} onChange={e => set('jobType', e.target.value)}>
              {JOB_TYPES.map(j => <option key={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Quantity</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.quantity} onChange={e => set('quantity', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Due date</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Priority</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        {/* Payment section */}
        <div className="border-t border-gray-100 pt-4 mt-3">
          <h3 className="font-semibold text-sm mb-3">Payment</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Total order value (R) *</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.totalValue} onChange={e => set('totalValue', Number(e.target.value))} />
              {errs.totalValue && <span className="text-xs text-red-600">{errs.totalValue}</span>}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment arrangement</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.paymentType} onChange={e => set('paymentType', e.target.value as PaymentArrangement)}>
                <option value="FULL">Full upfront</option>
                <option value="DEPOSIT_PCT">Deposit %</option>
                <option value="DEPOSIT_FIXED">Deposit fixed amount</option>
                <option value="COD">COD (Cash on delivery)</option>
              </select>
            </div>
            {form.paymentType === 'DEPOSIT_PCT' && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Deposit %</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.depositPct} onChange={e => set('depositPct', Number(e.target.value))} />
              </div>
            )}
            {form.paymentType === 'DEPOSIT_FIXED' && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Deposit amount (R)</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.depositFixed} onChange={e => set('depositFixed', Number(e.target.value))} />
              </div>
            )}
            {(form.paymentType === 'DEPOSIT_PCT' || form.paymentType === 'DEPOSIT_FIXED') && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={form.depositReceived} onChange={e => set('depositReceived', e.target.checked)} />
                  Deposit received?
                </label>
              </div>
            )}
          </div>

          {/* Live summary */}
          <div className="bg-gray-50 rounded-lg p-3 mt-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3">
              <div className="flex justify-between"><span className="text-gray-500">Excl. VAT</span><span>{fmtCurrency(vat.excl)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">VAT (15%)</span><span>{fmtCurrency(vat.vat)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Deposit</span><span className="text-purple-600 font-medium">{fmtCurrency(depositAmount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Balance due</span><span className="font-medium">{fmtCurrency(balance)}</span></div>
            </div>
            <div className="h-2 rounded overflow-hidden flex">
              <div className="bg-purple-400" style={{ width: `${depPct}%` }} />
              <div className="bg-emerald-200" style={{ width: `${100 - depPct}%` }} />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button onClick={() => save(false)} disabled={create.isPending} className="px-4 py-2 text-sm border border-brand text-brand rounded-lg disabled:opacity-50">
            {create.isPending ? 'Saving…' : 'Save order'}
          </button>
          <button onClick={() => save(true)} disabled={create.isPending || genInvoice.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
            Save & create invoice
          </button>
        </div>
      </div>
    </div>
  )
}
