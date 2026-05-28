import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { fmtCurrency, fmtDate } from '@/lib/formatters'
import { useApproveProof, useRejectProof, useAddProofComment } from '@/features/proofs/useProofs'
import { useAuthStore } from '@/features/auth/authStore'

const progressFor = (status: string) => ({
  NEW: 10, IN_PRODUCTION: 50, READY: 90, DELIVERED: 100, OVERDUE: 50,
}[status] ?? 10)

function OrderCard({ order }: { order: any }) {
  const pct = progressFor(order.status)
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold">{order.jobName}</div>
          <div className="text-xs text-gray-500">{order.orderNumber}</div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{order.status.replace('_', ' ')}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden mb-2">
        <div className="bg-brand h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>Due {fmtDate(order.dueDate)}</span>
        <span>{pct}% complete</span>
      </div>
    </div>
  )
}

function ProofApprovalCard({ proof }: { proof: any }) {
  const approve = useApproveProof()
  const reject = useRejectProof()
  const addComment = useAddProofComment()
  const [feedback, setFeedback] = useState<'idle' | 'approved' | 'rejected'>('idle')
  const [comment, setComment] = useState('')

  function handleApprove() {
    approve.mutate(proof.id, { onSuccess: () => setFeedback('approved') })
  }
  function handleReject() {
    reject.mutate(proof.id, { onSuccess: () => {
      if (comment.trim()) addComment.mutate({ id: proof.id, comment })
      setFeedback('rejected')
    }})
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold">{proof.order?.jobName}</div>
          <div className="text-xs text-gray-500">{proof.order?.orderNumber} · {proof.version}</div>
          <div className="text-xs text-gray-400">Uploaded {fmtDate(proof.createdAt)}</div>
        </div>
        <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">Download</a>
      </div>

      {feedback === 'approved' && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">Thanks! Your proof has been approved.</div>
      )}
      {feedback === 'rejected' && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">Revision noted — we'll be in touch.</div>
      )}
      {feedback === 'idle' && (
        <>
          <textarea
            placeholder="Comments (optional, required for revision)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <div className="flex gap-2">
            <button onClick={handleApprove} className="flex-1 bg-green-600 text-white text-sm py-2.5 rounded-lg font-medium min-h-[44px]">Approve</button>
            <button onClick={handleReject} className="flex-1 bg-red-600 text-white text-sm py-2.5 rounded-lg font-medium min-h-[44px]">Request revision</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function PortalPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const orders = useQuery<any[]>({ queryKey: ['portal', 'orders'], queryFn: () => api.get('/api/orders').then(r => r.data) })
  const proofs = useQuery<any[]>({ queryKey: ['portal', 'proofs'], queryFn: () => api.get('/api/proofs').then(r => r.data) })
  const invoices = useQuery<any[]>({ queryKey: ['portal', 'invoices'], queryFn: () => api.get('/api/invoices').then(r => r.data) })

  const pending = (proofs.data ?? []).filter((p: any) => p.status === 'PENDING')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand text-white px-5 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <div className="font-semibold">PrintShop Pro</div>
            <div className="text-xs opacity-80">Welcome, {user?.name}</div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="text-xs opacity-90 hover:opacity-100 min-h-[44px] px-3">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-6">
        <section>
          <h2 className="text-base font-semibold mb-3">Your orders</h2>
          {orders.isLoading ? <div className="h-24 bg-gray-200 animate-pulse rounded-xl" /> :
            (orders.data ?? []).length === 0 ? <div className="text-sm text-gray-400">No orders yet</div> :
              <div className="space-y-3">{(orders.data ?? []).map((o: any) => <OrderCard key={o.id} order={o} />)}</div>
          }
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Awaiting your approval ({pending.length})</h2>
          {proofs.isLoading ? <div className="h-24 bg-gray-200 animate-pulse rounded-xl" /> :
            !pending.length ? <div className="text-sm text-gray-400">Nothing waiting for your review</div> :
              <div className="space-y-3">{pending.map((p: any) => <ProofApprovalCard key={p.id} proof={p} />)}</div>
          }
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3">Your invoices</h2>
          {invoices.isLoading ? <div className="h-24 bg-gray-200 animate-pulse rounded-xl" /> :
            (invoices.data ?? []).length === 0 ? <div className="text-sm text-gray-400">No invoices yet</div> :
              <div className="space-y-2">
                {(invoices.data ?? []).map((inv: any) => (
                  <details key={inv.id} className="bg-white border border-gray-100 rounded-xl">
                    <summary className="flex justify-between items-center px-4 py-3 cursor-pointer min-h-[44px] text-sm">
                      <div>
                        <div className="font-medium">{inv.invoiceNumber}</div>
                        <div className="text-xs text-gray-500">{inv.order?.jobName}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmtCurrency(inv.amount)}</div>
                        <div className="text-xs text-gray-500">Due {fmtDate(inv.dueDate)}</div>
                      </div>
                    </summary>
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-gray-500">Type</span><span>{inv.invoiceType}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Paid</span><span>{fmtCurrency(inv.amountPaid)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Status</span><span>{inv.status}</span></div>
                    </div>
                  </details>
                ))}
              </div>
          }
        </section>
      </main>
    </div>
  )
}
