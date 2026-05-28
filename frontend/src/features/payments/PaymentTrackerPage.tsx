import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtCurrency, fmtDateTime } from '@/lib/formatters'
import { useOrderPayments, useRecordPayment } from './usePayments'
import { useAuthStore } from '@/features/auth/authStore'
import { useGenerateInvoice } from '@/features/orders/useOrders'

interface Order {
  id: string; orderNumber: string; jobName: string
  customer: { id: string; name: string }
  totalValue: number | string
  depositAmount: number | string
  depositReceived: boolean
  balancePaid: boolean
  paymentType: string
}

function RecordPaymentModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const record = useRecordPayment()
  const currentStaffId = useAuthStore(s => s.currentStaffId)
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: () => api.get('/api/auth/staff').then(r => r.data) })
  const total = Number(order?.totalValue ?? 0)
  const dep = Number(order?.depositAmount ?? 0)
  const outstanding = order?.depositReceived ? total - dep : total

  const [form, setForm] = useState({
    recordedById: currentStaffId || '',
    paymentType: 'balance',
    method: 'EFT',
    amount: outstanding,
    notes: '',
  })

  if (!order) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    record.mutate({ ...form, orderId: order!.id }, { onSuccess: () => onClose() })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold mb-1">Record payment</h2>
        <p className="text-xs text-gray-500 mb-3">{order.orderNumber} · {order.customer.name}</p>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Recorded by</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.recordedById} onChange={e => setForm(f => ({ ...f, recordedById: e.target.value }))}>
              <option value="">—</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.paymentType} onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}>
                <option value="deposit">Deposit</option>
                <option value="balance">Balance</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Method</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option>EFT</option><option>Cash</option><option>Card</option><option>SnapScan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Amount (R)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button disabled={record.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
            {record.isPending ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PaymentHistory({ orderId }: { orderId: string }) {
  const { data: payments = [], isLoading } = useOrderPayments(orderId)
  if (isLoading) return <div className="text-xs text-gray-400">Loading…</div>
  if (!payments.length) return <div className="text-xs text-gray-400">No payments yet</div>
  return (
    <div className="space-y-1">
      {payments.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
          <div>
            <span className="font-medium capitalize">{p.paymentType}</span>
            <span className="text-gray-500"> · {p.method}</span>
          </div>
          <div className="text-right">
            <div className="font-medium">{fmtCurrency(p.amount)}</div>
            <div className="text-gray-500">{fmtDateTime(p.paymentDate)} · {p.recordedBy?.name?.split(' ')[0]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

export default function PaymentTrackerPage() {
  const { data: orders = [], isLoading } = useQuery<Order[]>({ queryKey: ['orders'], queryFn: () => api.get('/api/orders').then(r => r.data) })
  const [recordingOrder, setRecordingOrder] = useState<Order | null>(null)
  const genInvoice = useGenerateInvoice()

  let depositsCollected = 0, balancesOutstanding = 0, fullyPaid = 0
  for (const o of orders) {
    const total = Number(o.totalValue); const dep = Number(o.depositAmount)
    if (o.balancePaid) { fullyPaid += total; continue }
    if (o.depositReceived) { depositsCollected += dep; balancesOutstanding += total - dep }
    else balancesOutstanding += total
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Payments</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Metric label="Deposits collected" value={fmtCurrency(depositsCollected)} tone="bg-purple-50 border-purple-100 text-purple-900" />
        <Metric label="Balances outstanding" value={fmtCurrency(balancesOutstanding)} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Fully paid" value={fmtCurrency(fullyPaid)} tone="bg-green-50 border-green-100 text-green-900" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-sm text-gray-400">No orders yet</div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const total = Number(o.totalValue); const dep = Number(o.depositAmount)
            const paid = o.balancePaid ? total : (o.depositReceived ? dep : 0)
            const bal = total - paid
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0
            return (
              <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">{o.jobName}</div>
                    <div className="text-xs text-gray-500">{o.orderNumber} · {o.customer.name}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{fmtCurrency(total)}</div>
                    <div className={`text-xs ${bal > 0 ? 'text-amber-700' : 'text-green-700'}`}>{bal > 0 ? `${fmtCurrency(bal)} due` : 'Fully paid'}</div>
                  </div>
                </div>
                <div className="h-2 rounded overflow-hidden bg-gray-100 mb-3">
                  <div className="bg-green-500 h-full" style={{ width: `${pct}%` }} />
                </div>
                <PaymentHistory orderId={o.id} />
                <div className="flex gap-2 mt-3">
                  {bal > 0 && (
                    <button onClick={() => setRecordingOrder(o)} className="text-xs px-3 py-1.5 bg-brand text-white rounded">Record payment</button>
                  )}
                  <button onClick={() => genInvoice.mutate(o.id)} className="text-xs px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50">Invoice</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RecordPaymentModal order={recordingOrder} onClose={() => setRecordingOrder(null)} />
    </div>
  )
}
