import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDateTime } from '@/lib/formatters'
import { useAllProofs, useApproveProof, useRejectProof, useAddProofComment, useUploadProof } from './useProofs'

const statusBadge: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REVISION_REQUESTED: 'bg-red-100 text-red-700',
}

function UploadProofModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const upload = useUploadProof()
  const { data: orders = [] } = useQuery<any[]>({ queryKey: ['orders'], queryFn: () => api.get('/api/orders').then(r => r.data), enabled: open })
  const [form, setForm] = useState({ orderId: '', version: 'v1', fileName: '', notes: '' })
  const [progress, setProgress] = useState(0)

  if (!open) return null

  function fakeUpload(file: File) {
    setProgress(0)
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(id); return 100 }
        return p + 10
      })
    }, 80)
    setForm(f => ({ ...f, fileName: file.name }))
  }

  function submit() {
    if (!form.orderId || !form.fileName) return
    upload.mutate({
      orderId: form.orderId,
      version: form.version,
      fileName: form.fileName,
      fileUrl: `https://storage.example.com/proofs/${form.fileName}`,
      notes: form.notes,
    }, { onSuccess: () => { onClose(); setProgress(0); setForm({ orderId: '', version: 'v1', fileName: '', notes: '' }) } })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold mb-3">Upload proof</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Order</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.orderId} onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))}>
              <option value="">—</option>
              {orders.map((o: any) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.jobName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Version</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}>
              <option>v1</option><option>v2</option><option>v3</option><option>v4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">File (PDF/AI/PSD/PNG/JPG, max 50MB)</label>
            <input type="file" accept=".pdf,.ai,.psd,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0]; if (f) fakeUpload(f) }} className="text-xs" />
            {form.fileName && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">{form.fileName}</div>
                <div className="h-1.5 bg-gray-100 rounded overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notes</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={progress < 100 || upload.isPending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50">
            {upload.isPending ? 'Saving…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProofCard({ proof }: { proof: any }) {
  const approve = useApproveProof()
  const reject = useRejectProof()
  const comment = useAddProofComment()
  const [text, setText] = useState('')
  const [showComment, setShowComment] = useState(false)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium text-sm">{proof.order?.jobName ?? proof.fileName}</div>
          <div className="text-xs text-gray-500">{proof.order?.orderNumber} <span className="inline-block ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">{proof.version}</span></div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[proof.status] || 'bg-gray-100'}`}>{proof.status.replace('_', ' ')}</span>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-3 text-sm">
        <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 011 1v4h4a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1h3z" /></svg>
        <span className="flex-1 truncate text-xs">{proof.fileName}</span>
        <a href={proof.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">Download</a>
      </div>

      {proof.comments?.length > 0 && (
        <div className="space-y-1 mb-3">
          {proof.comments.map((c: any) => (
            <div key={c.id} className="text-xs bg-gray-50 rounded px-2 py-1">
              <span className="font-medium">{c.user?.name?.split(' ')[0]}:</span> <span className="text-gray-700">{c.comment}</span>
              <span className="text-gray-400 ml-2">{fmtDateTime(c.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {proof.status === 'PENDING' && (
        <div className="flex gap-2">
          <button onClick={() => approve.mutate(proof.id)} className="text-xs px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded">Approve</button>
          <button onClick={() => reject.mutate(proof.id)} className="text-xs px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded">Request revision</button>
          <button onClick={() => setShowComment(s => !s)} className="text-xs px-3 py-1.5 border border-gray-200 rounded">Add comment</button>
        </div>
      )}
      {showComment && (
        <div className="mt-3 flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Comment…" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
          <button onClick={() => { if (text.trim()) { comment.mutate({ id: proof.id, comment: text }); setText(''); setShowComment(false) } }} className="text-xs px-3 py-1 bg-brand text-white rounded">Post</button>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

export default function ProofingPage() {
  const { data: proofs = [], isLoading } = useAllProofs()
  const [showUpload, setShowUpload] = useState(false)

  const today = new Date().toDateString()
  const weekAgo = Date.now() - 7 * 86400000
  const awaiting = proofs.filter(p => p.status === 'PENDING').length
  const approvedToday = proofs.filter(p => p.status === 'APPROVED' && new Date(p.createdAt).toDateString() === today).length
  const revision = proofs.filter(p => p.status === 'REVISION_REQUESTED').length
  const week = proofs.filter(p => new Date(p.createdAt).getTime() >= weekAgo).length

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Proofing</h1>
        <button onClick={() => setShowUpload(true)} className="bg-brand text-white text-sm px-4 py-2 rounded-lg">+ Upload proof</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Awaiting approval" value={awaiting} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Approved today" value={approvedToday} tone="bg-green-50 border-green-100 text-green-900" />
        <Metric label="Revision requested" value={revision} tone="bg-red-50 border-red-100 text-red-900" />
        <Metric label="This week" value={week} tone="bg-blue-50 border-blue-100 text-blue-900" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />)}</div>
      ) : proofs.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-sm text-gray-400">No proofs yet — click "Upload proof" to add one</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {proofs.map((p: any) => <ProofCard key={p.id} proof={p} />)}
        </div>
      )}

      <UploadProofModal open={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  )
}
