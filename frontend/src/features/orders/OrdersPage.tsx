import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useOrders, useAdvanceStatus, useGenerateInvoice } from './useOrders'
import { fmtCurrency, fmtDate, orderStatusColour } from '@/lib/formatters'
import { api } from '@/lib/api'
import NewOrderModal from './NewOrderModal'

const STATUS_NEXT: Record<string, string> = {
  NEW: 'IN_PRODUCTION',
  IN_PRODUCTION: 'READY',
  READY: 'DELIVERED',
}

export default function OrdersPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [capturedByFilter, setCapturedByFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [params] = useSearchParams()
  const highlightId = params.get('highlight')

  const filters: Record<string, string> = {}
  if (statusFilter) filters.status = statusFilter
  if (capturedByFilter) filters.capturedById = capturedByFilter
  const { data: orders = [], isLoading } = useOrders(Object.keys(filters).length ? filters : undefined)
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: () => api.get('/api/auth/staff').then(r => r.data) })
  const advanceStatus = useAdvanceStatus()
  const generateInvoice = useGenerateInvoice()

  const filtered = orders.filter(o =>
    !search || o.jobName.toLowerCase().includes(search.toLowerCase()) ||
    o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    o.orderNumber.toLowerCase().includes(search.toLowerCase())
  )

  const getBalance = (o: any) => {
    const dep = Number(o.depositAmount)
    const total = Number(o.totalValue)
    if (o.paymentType === 'FULL') return o.balancePaid ? 0 : total
    if (o.paymentType === 'COD')  return o.balancePaid ? 0 : total
    return o.balancePaid ? 0 : total - dep
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Orders</h1>
        <button onClick={() => setShowNew(true)} className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark transition">
          + New order
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
          placeholder="Search orders…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {['NEW','IN_PRODUCTION','READY','DELIVERED','OVERDUE'].map(s =>
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          )}
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={capturedByFilter}
          onChange={e => setCapturedByFilter(e.target.value)}
        >
          <option value="">Captured by — all</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading orders…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['ID','Job','Customer','Value','Payment','Status','Due','Captured by','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const bal = getBalance(o)
                  const dep = Number(o.depositAmount)
                  const total = Number(o.totalValue)
                  const depPct = total > 0 ? Math.round(dep / total * 100) : 0
                  return (
                    <tr key={o.id} className={`border-b border-gray-50 hover:bg-gray-50 ${highlightId === o.id ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.orderNumber}</td>
                      <td className="px-4 py-3 font-medium max-w-xs truncate">{o.jobName}</td>
                      <td className="px-4 py-3 text-gray-600">{o.customer.name}</td>
                      <td className="px-4 py-3 font-semibold">{fmtCurrency(total)}</td>
                      <td className="px-4 py-3">
                        <div className="w-20">
                          <div className="flex h-1.5 rounded overflow-hidden mb-1">
                            <div className="bg-purple-400" style={{ width: `${depPct}%` }} />
                            <div className={`${o.balancePaid ? 'bg-green-400' : 'bg-gray-200'}`} style={{ width: `${100-depPct}%` }} />
                          </div>
                          {bal > 0 ? (
                            <span className="text-xs text-amber-600">Bal: {fmtCurrency(bal)}</span>
                          ) : (
                            <span className="text-xs text-green-600">Paid</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusColour[o.status] || 'bg-gray-100 text-gray-600'}`}>
                          {o.status.replace('_',' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(o.dueDate)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{o.capturedBy?.name?.split(' ')[0]}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {STATUS_NEXT[o.status] && (
                            <button
                              onClick={() => advanceStatus.mutate({ id: o.id, status: STATUS_NEXT[o.status] })}
                              className="text-xs px-2 py-1 border border-gray-200 rounded-md hover:bg-gray-100"
                            >
                              Advance
                            </button>
                          )}
                          <button
                            onClick={() => generateInvoice.mutate(o.id)}
                            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-600 hover:text-white transition font-medium"
                          >
                            Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No orders found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <NewOrderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
