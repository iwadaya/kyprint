import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function useReminderSchedule() {
  return useQuery<any[]>({ queryKey: ['reminders', 'schedule'], queryFn: () => api.get('/api/reminders/schedule').then(r => r.data) })
}

export function useUpcomingReminders() {
  return useQuery<any[]>({ queryKey: ['reminders', 'upcoming'], queryFn: () => api.get('/api/reminders/upcoming').then(r => r.data) })
}

export function useReminderLog() {
  return useQuery<any[]>({ queryKey: ['reminders', 'log'], queryFn: () => api.get('/api/reminders/log').then(r => r.data) })
}

export function useToggleScheduleStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/api/reminders/schedule/${id}`, { active }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); toast.success('Schedule updated') },
    onError: () => toast.error('Failed to update'),
  })
}

export function useSendReminderNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => api.post(`/api/reminders/send-now/${invoiceId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); toast.success('Reminder sent') },
    onError: () => toast.error('Failed to send reminder'),
  })
}

export function useStopReminders() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => api.patch(`/api/reminders/stop/${invoiceId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); toast.success('Reminders stopped') },
    onError: () => toast.error('Failed to stop reminders'),
  })
}
