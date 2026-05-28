import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useDeliveries(filters?: Record<string, string>) {
  return useQuery<any[]>({
    queryKey: ['deliveries', filters],
    queryFn: () => api.get('/api/deliveries', { params: filters }).then(r => r.data),
  })
}

export function useScheduleDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/api/deliveries', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deliveries'] }); toast.success('Delivery scheduled') },
    onError: () => toast.error('Failed to schedule delivery'),
  })
}

export function useMarkDelivered() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/deliveries/${id}/delivered`).then(r => r.data),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['deliveries'] })
      const prev = qc.getQueryData<any[]>(['deliveries'])
      qc.setQueriesData<any[]>({ queryKey: ['deliveries'] }, old => old?.map(d => d.id === id ? { ...d, status: 'DELIVERED' } : d) ?? [])
      return { prev }
    },
    onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['deliveries'], ctx.prev); toast.error('Failed to update') },
    onSuccess: () => toast.success('Marked delivered'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  })
}
