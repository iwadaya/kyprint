import { useState } from 'react'
import { useInvoices, useMarkPaid, useEmailInvoice, type Invoice } from './useInvoices'
import { fmtCurrency, fmtDate, calcVAT, invoiceStatusColour } from '@/lib/formatters'

function InvoicePreviewModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const email = useEmailInvoice()
  if (!invoice) return null
  const amount = Number(invoice.amount)
  const vat = calcVAT(amount)
  const isBalance = invoice.invoiceType.toLowerCase().includes('balance')
  const orderTotal = Number(invoice.order?.totalValue ?? 0)
  const deposit = Number(invoice.order?.depositAmount ?? 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-brand text-white px-6 py-5 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-lg font-semibold">PrintShop Pro</div>
              <div className="text-xs opacity-80 mt-1">10 Sandton Drive, Johannesburg, 2196</div>
              <div className="text-xs opacity-80">VAT: 4490292099</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide opacity-80">{invoice.invoiceType}</div>
              <div className="font-mono text-sm">{invoice.invoiceNumber}</div>
              <div className="text-xs opacity-80">{fmtDate(invoice.invoiceDate)}</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Bill to</div>
              <div className="font-medium">{invoice.customer?.name}</div>
              <div className="text-gray-600">{invoice.customer?.email}</div>
              <div className="text-gray-600">{invoice.customer?.phone}</div>
              <div className="text-gray-600">{invoice.customer?.address}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Order reference</div>
              <div className="font-mono">{invoice.order?.orderNumber}</div>
              <div className="text-gray-600">{invoice.order?.jobName}</div>
              <div className="text-gray-600">Due: {fmtDate(invoice.dueDate)}</div>
            </div>
          </div>

          <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Excl. VAT</th>
                <th className="text-right px-3 py-2">VAT (15%)</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">{invoice.order?.jobName} — {invoice.invoiceType}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(vat.excl)}</td>
                <td className="px-3 py-2 text-right">{fmtCurrency(vat.vat)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtCurrency(amount)}</td>
              </tr>
              {isBalance && deposit > 0 && (
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-purple-600">Less: deposit paid</td>
                  <td colSpan={2} className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right text-purple-600">- {fmtCurrency(deposit)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-col items-end text-sm space-y-1">
            <div className="flex gap-6"><span className="text-gray-500">Subtotal</span><span>{fmtCurrency(vat.excl)}</span></div>
            <div className="flex gap-6"><span className="text-gray-500">VAT (15%)</span><span>{fmtCurrency(vat.vat)}</span></div>
            <div className="flex gap-6 text-lg pt-2">
              <span className="font-semibold">Amount due</span>
              <span className="font-bold text-brand">{fmtCurrency(amount)}</span>
            </div>
          </div>

          {(isBalance || (orderTotal > 0 && deposit > 0)) && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs">
              <div className="font-semibold text-gray-700 mb-1">Payment summary for order</div>
              <div className="flex justify-between"><span>Order total</span><span>{fmtCurrency(orderTotal)}</span></div>
              <div className="flex justify-between text-purple-700"><span>Deposit</span><span>{fmtCurrency(deposit)}</span></div>
              <div className="flex justify-between"><span>Balance</span><span>{fmtCurrency(Math.max(0, orderTotal - deposit))}</span></div>
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-900">
            <div className="font-semibold mb-1">Banking details</div>
            <div>Bank: Standard Bank · Acc: 012 345 678 · Branch: 051001</div>
            <div>Reference: {invoice.invoiceNumber}</div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => window.print()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Export PDF</button>
            <button onClick={() => email.mutate(invoice.id)} disabled={email.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
              {email.isPending ? 'Sending…' : 'Email to customer'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Close</button>
          </div>
        </div>
      </div>
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

export default function InvoicesPage() {
  const { data: invoices = [], isLoading, isError, refetch } = useInvoices()
  const markPaid = useMarkPaid()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = invoices.find(i => i.id === previewId) || null

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0)
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amountPaid), 0)
  const outstanding = totalInvoiced - totalPaid
  const overdue = invoices
    .filter(i => i.status !== 'PAID' && new Date(i.dueDate) < new Date())
    .reduce((s, i) => s + (Number(i.amount) - Number(i.amountPaid)), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Invoices</h1>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-3 flex items-center justify-between">
          <span>Failed to load invoices.</span>
          <button onClick={() => refetch()} className="text-xs underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Total invoiced" value={fmtCurrency(totalInvoiced)} tone="bg-blue-50 border-blue-100 text-blue-900" />
        <Metric label="Paid" value={fmtCurrency(totalPaid)} tone="bg-green-50 border-green-100 text-green-900" />
        <Metric label="Outstanding" value={fmtCurrency(outstanding)} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Overdue" value={fmtCurrency(overdue)} tone="bg-red-50 border-red-100 text-red-900" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />)}</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No invoices yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Invoice #', 'Order', 'Customer', 'Type', 'Amount', 'Balance', 'Status', 'Captured by', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const amt = Number(inv.amount); const paid = Number(inv.amountPaid); const bal = amt - paid
                return (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{inv.order?.orderNumber}</td>
                    <td className="px-4 py-3">{inv.customer?.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{inv.invoiceType}</td>
                    <td className="px-4 py-3 font-medium">{fmtCurrency(amt)}</td>
                    <td className="px-4 py-3 text-amber-700">{fmtCurrency(bal)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${invoiceStatusColour[inv.status] || 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{inv.capturedBy?.name?.split(' ')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setPreviewId(inv.id)} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-100">View</button>
                        {inv.status !== 'PAID' && (
                          <button onClick={() => markPaid.mutate({ id: inv.id, amount: amt })} className="text-xs px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100">Mark paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <InvoicePreviewModal invoice={preview} onClose={() => setPreviewId(null)} />
    </div>
  )
}
