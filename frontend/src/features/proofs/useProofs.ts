import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useAllProofs() {
  return useQuery<any[]>({ queryKey: ['proofs'], queryFn: () => api.get('/api/proofs').then(r => r.data) })
}

export function useProofsByOrder(orderId: string | null) {
  return useQuery<any[]>({
    queryKey: ['proofs', 'order', orderId],
    queryFn: () => api.get(`/api/proofs/order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })
}

export function useApproveProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/proofs/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proofs'] }); toast.success('Proof approved') },
    onError: () => toast.error('Failed to approve proof'),
  })
}

export function useRejectProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/api/proofs/${id}/reject`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proofs'] }); toast.success('Revision requested') },
    onError: () => toast.error('Failed to reject proof'),
  })
}

export function useAddProofComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      api.post(`/api/proofs/${id}/comment`, { comment }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proofs'] }); toast.success('Comment added') },
    onError: () => toast.error('Failed to add comment'),
  })
}

export function useUploadProof() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { orderId: string; fileName: string; fileUrl: string; version: string; notes?: string }) =>
      api.post('/api/proofs', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proofs'] }); toast.success('Proof uploaded') },
    onError: () => toast.error('Failed to upload proof'),
  })
}
