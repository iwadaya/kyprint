import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { fmtCurrency, fmtDate, orderStatusColour } from '@/lib/formatters'

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs font-medium opacity-80 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function Skeleton({ h = 'h-24' }: { h?: string }) {
  return <div className={`${h} bg-gray-100 rounded-xl animate-pulse`} />
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const orders = useQuery<any[]>({ queryKey: ['orders'], queryFn: () => api.get('/api/orders').then(r => r.data) })
  const stockAlerts = useQuery<any[]>({ queryKey: ['stock', 'alerts'], queryFn: () => api.get('/api/stock/alerts').then(r => r.data) })
  const upcoming = useQuery<any[]>({ queryKey: ['reminders', 'upcoming'], queryFn: () => api.get('/api/reminders/upcoming').then(r => r.data) })
  const invoices = useQuery<any[]>({ queryKey: ['invoices'], queryFn: () => api.get('/api/invoices').then(r => r.data) })
  const deliveries = useQuery<any[]>({ queryKey: ['deliveries'], queryFn: () => api.get('/api/deliveries').then(r => r.data) })

  const orderList = orders.data ?? []
  const counts = {
    active: orderList.filter(o => ['NEW', 'IN_PRODUCTION'].includes(o.status)).length,
    production: orderList.filter(o => o.status === 'IN_PRODUCTION').length,
    ready: orderList.filter(o => o.status === 'READY').length,
    overdue: orderList.filter(o => o.status === 'OVERDUE' || (new Date(o.dueDate) < new Date() && o.status !== 'DELIVERED')).length,
  }

  const invList = invoices.data ?? []
  const totalInvoiced = invList.reduce((s, i) => s + Number(i.amount), 0)
  const totalPaid = invList.reduce((s, i) => s + Number(i.amountPaid), 0)
  const outstanding = totalInvoiced - totalPaid

  const today = new Date().toDateString()
  const todaysDeliveries = (deliveries.data ?? []).filter(d => new Date(d.deliveryDate).toDateString() === today)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5">Today's overview</p>
      </div>

      {orders.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Metric label="Active orders" value={counts.active} tone="bg-blue-50 border-blue-100 text-blue-900" />
          <Metric label="In production" value={counts.production} tone="bg-amber-50 border-amber-100 text-amber-900" />
          <Metric label="Ready" value={counts.ready} tone="bg-green-50 border-green-100 text-green-900" />
          <Metric label="Overdue" value={counts.overdue} tone="bg-red-50 border-red-100 text-red-900" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recent orders" action={<button onClick={() => navigate('/orders')} className="text-xs text-brand hover:underline">View all</button>}>
          {orders.isLoading ? <Skeleton h="h-40" /> : orderList.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6">No orders yet — create your first order on the Orders page</div>
          ) : (
            <div className="space-y-1">
              {orderList.slice(0, 8).map(o => (
                <button key={o.id}
                  onClick={() => navigate(`/orders?highlight=${o.id}`)}
                  className="w-full text-left flex items-center justify-between text-sm py-2 px-2 rounded hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span className="font-medium truncate max-w-[200px]">{o.jobName}</span>
                    <span className="text-xs text-gray-400">{o.customer?.name} · {o.orderNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{fmtCurrency(o.totalValue)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${orderStatusColour[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status.replace('_', ' ')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Today's deliveries">
          {deliveries.isLoading ? <Skeleton h="h-40" /> : todaysDeliveries.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6">No deliveries scheduled today</div>
          ) : (
            <div className="space-y-2">
              {todaysDeliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="font-medium">{d.order?.jobName ?? '—'}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[260px]">{d.address}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">{d.timeSlot}</div>
                    <div className="text-xs text-gray-400">{d.driver?.name?.split(' ')[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Stock alerts" action={<button onClick={() => navigate('/stock')} className="text-xs text-brand hover:underline">Manage</button>}>
          {stockAlerts.isLoading ? <Skeleton h="h-40" /> : (stockAlerts.data ?? []).length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6">All stock levels healthy</div>
          ) : (
            <div className="space-y-3">
              {(stockAlerts.data ?? []).slice(0, 6).map((s: any) => {
                const pct = s.minLevel > 0 ? Math.min(100, Math.round((s.quantity / s.minLevel) * 100)) : 0
                const colour = s.quantity === 0 ? 'bg-red-500' : 'bg-amber-500'
                return (
                  <div key={s.id} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-gray-500">{s.quantity} / {s.minLevel} {s.unit}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                      <div className={colour} style={{ width: `${pct}%`, height: '100%' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Payment summary">
          {invoices.isLoading ? <Skeleton h="h-40" /> : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total invoiced</span><span className="font-semibold">{fmtCurrency(totalInvoiced)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-semibold text-green-700">{fmtCurrency(totalPaid)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="font-semibold text-amber-700">{fmtCurrency(outstanding)}</span></div>
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-500 mb-1">Upcoming reminders ({(upcoming.data ?? []).length})</div>
                {(upcoming.data ?? []).slice(0, 3).map((u: any) => (
                  <div key={`${u.invoice.id}-${u.step.id}`} className="text-xs flex justify-between py-1">
                    <span>{u.invoice.invoiceNumber}</span>
                    <span className="text-gray-500">{fmtDate(u.triggerDate)} · {u.step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
