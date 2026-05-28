import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/formatters'
import { useDeliveries, useScheduleDelivery, useMarkDelivered } from './useDeliveries'
import { useAuthStore } from '@/features/auth/authStore'

const TIME_SLOTS = ['08:00 – 10:00', '10:00 – 12:00', '12:00 – 14:00', '14:00 – 16:00', '16:00 – 18:00']

const statusBadge: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
}

function ScheduleDeliveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const schedule = useScheduleDelivery()
  const currentStaffId = useAuthStore(s => s.currentStaffId)
  const { data: orders = [] } = useQuery<any[]>({ queryKey: ['orders'], queryFn: () => api.get('/api/orders').then(r => r.data), enabled: open })
  const { data: drivers = [] } = useQuery<any[]>({ queryKey: ['staff', 'DRIVER'], queryFn: () => api.get('/api/auth/staff?role=DRIVER').then(r => r.data), enabled: open })

  const [form, setForm] = useState({
    orderId: '', driverId: '', address: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    timeSlot: TIME_SLOTS[0],
    capturedById: currentStaffId || '',
  })

  if (!open) return null

  function onOrderChange(id: string) {
    const o = orders.find((o: any) => o.id === id)
    setForm(f => ({ ...f, orderId: id, address: o?.customer?.address || '' }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    schedule.mutate({
      orderId: form.orderId,
      driverId: form.driverId,
      address: form.address,
      deliveryDate: new Date(form.deliveryDate).toISOString(),
      timeSlot: form.timeSlot,
    }, { onSuccess: () => onClose() })
  }

  const readyOrders = orders.filter((o: any) => o.status === 'READY')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold mb-3">Schedule delivery</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Order (status = READY)</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.orderId} onChange={e => onOrderChange(e.target.value)} required>
              <option value="">—</option>
              {readyOrders.map((o: any) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.jobName}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Time slot</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.timeSlot} onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Driver</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} required>
              <option value="">—</option>
              {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Delivery address</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button disabled={schedule.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
            {schedule.isPending ? 'Saving…' : 'Schedule'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function DeliveriesPage() {
  const [dateFilter, setDateFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)

  const filters: Record<string, string> = {}
  if (dateFilter) filters.date = dateFilter
  if (driverFilter) filters.driverId = driverFilter

  const { data: deliveries = [], isLoading } = useDeliveries(Object.keys(filters).length ? filters : undefined)
  const { data: drivers = [] } = useQuery<any[]>({ queryKey: ['staff', 'DRIVER'], queryFn: () => api.get('/api/auth/staff?role=DRIVER').then(r => r.data) })
  const markDelivered = useMarkDelivered()

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Deliveries</h1>
        <button onClick={() => setShowSchedule(true)} className="bg-brand text-white text-sm px-4 py-2 rounded-lg">+ Schedule delivery</button>
      </div>

      <div className="flex gap-3 mb-4">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All drivers</option>
          {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-4 space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div> :
          deliveries.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">No deliveries scheduled</div> :
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Order', 'Address', 'Date', 'Time', 'Driver', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}
              </tr></thead>
              <tbody>
                {deliveries.map((d: any) => (
                  <tr key={d.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{d.order?.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{d.address}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(d.deliveryDate)}</td>
                    <td className="px-4 py-3 text-xs">{d.timeSlot}</td>
                    <td className="px-4 py-3 text-xs">{d.driver?.name}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[d.status] || 'bg-gray-100'}`}>{d.status}</span></td>
                    <td className="px-4 py-3">
                      {d.status !== 'DELIVERED' && (
                        <button onClick={() => markDelivered.mutate(d.id)} className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded">Mark delivered</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>

      <ScheduleDeliveryModal open={showSchedule} onClose={() => setShowSchedule(false)} />
    </div>
  )
}
