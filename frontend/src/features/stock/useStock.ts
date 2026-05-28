import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export interface StockItem {
  id: string; name: string; category: string; quantity: number; minLevel: number; unit: string; updatedAt: string
}

export function useStock() {
  return useQuery<StockItem[]>({ queryKey: ['stock'], queryFn: () => api.get('/api/stock').then(r => r.data) })
}

export function useStockAlerts() {
  return useQuery<StockItem[]>({ queryKey: ['stock', 'alerts'], queryFn: () => api.get('/api/stock/alerts').then(r => r.data) })
}

export function useAddStockItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<StockItem>) => api.post('/api/stock', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock'] }); toast.success('Material added') },
    onError: () => toast.error('Failed to add material'),
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.patch(`/api/stock/${id}/adjust`, { quantity }).then(r => r.data),
    onMutate: async ({ id, quantity }) => {
      await qc.cancelQueries({ queryKey: ['stock'] })
      const prev = qc.getQueryData<StockItem[]>(['stock'])
      qc.setQueryData<StockItem[]>(['stock'], old => old?.map(s => s.id === id ? { ...s, quantity } : s) ?? [])
      return { prev }
    },
    onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['stock'], ctx.prev); toast.error('Failed to update stock') },
    onSuccess: () => toast.success('Stock updated'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['stock'] }),
  })
}
