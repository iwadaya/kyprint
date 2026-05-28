import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/formatters'
import { useWaLog, useSendWA } from './useWhatsApp'

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function Bubble({ tone, title, body }: { tone: 'green' | 'red'; title: string; body: string }) {
  const cls = tone === 'green' ? 'bg-green-100 border-green-200' : 'bg-red-50 border-red-200'
  return (
    <div className={`rounded-xl border p-3 text-xs ${cls}`}>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-gray-700 whitespace-pre-line">{body}</div>
    </div>
  )
}

export default function WhatsAppPage() {
  const { data: logs = [], isLoading } = useWaLog()
  const { data: orders = [] } = useQuery<any[]>({ queryKey: ['orders'], queryFn: () => api.get('/api/orders').then(r => r.data) })
  const send = useSendWA()

  const today = new Date().toDateString()
  const sentToday = logs.filter((l: any) => new Date(l.sentAt).toDateString() === today && l.status === 'sent').length
  const failed = logs.filter((l: any) => l.status === 'failed').length
  const pending = orders.filter((o: any) => o.status === 'READY').length
  const total = logs.length || 1
  const rate = Math.round(((logs.filter((l: any) => l.status === 'sent').length) / total) * 100)

  const readyOrders = orders.filter((o: any) => o.status === 'READY')

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">WhatsApp</h1>
        <button
          onClick={() => readyOrders.forEach((o: any) => send.mutate({ orderId: o.id, customerPhone: o.customer.phone, templateName: 'ORDER_READY' }))}
          disabled={!readyOrders.length}
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
          Send all pending ({readyOrders.length})
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Sent today" value={sentToday} tone="bg-green-50 border-green-100 text-green-900" />
        <Metric label="Pending" value={pending} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Failed" value={failed} tone="bg-red-50 border-red-100 text-red-900" />
        <Metric label="Delivery rate" value={`${rate}%`} tone="bg-blue-50 border-blue-100 text-blue-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Pending */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Pending notifications</h3>
          {!readyOrders.length ? (
            <div className="text-xs text-gray-400 py-6 text-center">No orders ready for notification</div>
          ) : (
            <div className="space-y-2">
              {readyOrders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="font-medium">{o.jobName}</div>
                    <div className="text-xs text-gray-500">{o.customer.name} · {o.customer.phone}</div>
                  </div>
                  <button onClick={() => send.mutate({ orderId: o.id, customerPhone: o.customer.phone, templateName: 'ORDER_READY' })}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded">Send now</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Message log</h3>
          {isLoading ? <div className="text-xs text-gray-400">Loading…</div> :
            !logs.length ? <div className="text-xs text-gray-400 py-6 text-center">No messages sent yet</div> :
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`w-2 h-2 rounded-full ${l.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div className="flex-1">
                      <div className="font-medium">{l.order?.orderNumber}</div>
                      <div className="text-gray-500">{l.customerPhone}</div>
                    </div>
                    <div className="text-right text-gray-500">
                      <div>{fmtDateTime(l.sentAt)}</div>
                      <div className="text-xs">{l.sentBy?.name?.split(' ')[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3">Message templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Bubble tone="green" title="ORDER_READY" body={"Hi {customer_name},\nYour order {order_id} ({job_name}) is ready for collection at {shop_address}."} />
          <Bubble tone="red"   title="PAYMENT_REMINDER" body={"Hi {customer_name},\nFriendly reminder that invoice {invoice_number} of {amount} is due {due_date}."} />
          <Bubble tone="green" title="PAYMENT_RECEIVED" body={"Thank you {customer_name}!\nWe've received {amount_paid} for order {order_number}."} />
        </div>
      </div>
    </div>
  )
}
