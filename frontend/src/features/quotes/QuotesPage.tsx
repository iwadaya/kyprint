import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtCurrency, fmtDate } from '@/lib/formatters'
import { toast } from 'sonner'

const statusBadge: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-gray-100 text-gray-600',
}

export default function QuotesPage() {
  const qc = useQueryClient()
  const { data: quotes = [], isLoading } = useQuery<any[]>({ queryKey: ['quotes'], queryFn: () => api.get('/api/quotes').then(r => r.data) })
  const convert = useMutation({
    mutationFn: (id: string) => api.post(`/api/quotes/${id}/convert`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Quote converted to order') },
    onError: () => toast.error('Failed to convert quote'),
  })

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Quotes</h1>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? <div className="p-4">Loading…</div> :
          quotes.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">No quotes yet</div> :
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Quote #', 'Customer', 'Description', 'Value', 'Valid until', 'Status', 'Actions'].map(h =>
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}
              </tr></thead>
              <tbody>
                {quotes.map((q: any) => (
                  <tr key={q.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{q.quoteNumber}</td>
                    <td className="px-4 py-3">{q.customer?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{q.description}</td>
                    <td className="px-4 py-3 font-medium">{fmtCurrency(q.value)}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(q.validUntil)}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[q.status] || 'bg-gray-100'}`}>{q.status}</span></td>
                    <td className="px-4 py-3">
                      {q.status === 'PENDING' && (
                        <button onClick={() => convert.mutate(q.id)} className="text-xs px-3 py-1.5 bg-brand text-white rounded">Convert to order</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}
