import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/formatters'
import { useReminderSchedule, useUpcomingReminders, useReminderLog, useToggleScheduleStep, useSendReminderNow, useStopReminders } from './useReminders'

const triggerTone: Record<string, string> = {
  pre: 'bg-blue-100 text-blue-700 border-blue-200',
  due: 'bg-purple-100 text-purple-700 border-purple-200',
  post: 'bg-amber-100 text-amber-700 border-amber-200',
  final: 'bg-red-100 text-red-700 border-red-200',
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 border ${tone}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function ScheduleTab() {
  const schedule = useReminderSchedule()
  const upcoming = useUpcomingReminders()
  const toggle = useToggleScheduleStep()

  const steps = schedule.data ?? []
  const activeSteps = steps.filter(s => s.active).length
  const upcomingCount = (upcoming.data ?? []).length

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric label="Schedule steps" value={steps.length} tone="bg-blue-50 border-blue-100 text-blue-900" />
        <Metric label="Active steps" value={activeSteps} tone="bg-green-50 border-green-100 text-green-900" />
        <Metric label="Upcoming (7 days)" value={upcomingCount} tone="bg-amber-50 border-amber-100 text-amber-900" />
        <Metric label="Channels" value="WhatsApp + Email" tone="bg-purple-50 border-purple-100 text-purple-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Reminder sequence</h3>
          {schedule.isLoading ? <div className="text-xs text-gray-400">Loading…</div> :
            <div className="space-y-2">
              {steps.map((s: any) => (
                <div key={s.id} className={`flex items-center justify-between border rounded-lg p-2.5 ${triggerTone[s.triggerType] || 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-mono">{s.daysOffset > 0 ? `+${s.daysOffset}` : s.daysOffset}</div>
                    <div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs opacity-70">{Array.isArray(s.channels) ? s.channels.join(' + ') : 'wa'}</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={s.active} onChange={() => toggle.mutate({ id: s.id, active: !s.active })} />
                    <div className="w-9 h-5 bg-gray-200 peer-checked:bg-brand rounded-full transition" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          }
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Upcoming reminders (next 7 days)</h3>
          {upcoming.isLoading ? <div className="text-xs text-gray-400">Loading…</div> :
            !upcomingCount ? <div className="text-xs text-gray-400 py-6 text-center">Nothing scheduled in the next week</div> :
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(upcoming.data ?? []).map((u: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="font-mono text-xs">{u.invoice.invoiceNumber}</div>
                      <div className="text-xs text-gray-500">{u.invoice.customer?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs">{u.step.label}</div>
                      <div className="text-xs text-gray-500">{fmtDate(u.triggerDate)}</div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}

function PerInvoiceTab() {
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ['invoices'], queryFn: () => api.get('/api/invoices').then(r => r.data) })
  const sendNow = useSendReminderNow()
  const stop = useStopReminders()
  const unpaid = invoices.filter((i: any) => i.status !== 'PAID')

  return (
    <div className="space-y-3">
      {unpaid.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-sm text-gray-400">No outstanding invoices</div>
      ) : unpaid.map((inv: any) => (
        <div key={inv.id} className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-sm">{inv.invoiceNumber}</div>
              <div className="text-xs text-gray-500">{inv.customer?.name} · Due {fmtDate(inv.dueDate)}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{fmtCurrency(inv.amount)}</div>
              <div className="text-xs text-amber-700">{fmtCurrency(Number(inv.amount) - Number(inv.amountPaid))} due</div>
            </div>
          </div>
          <div className="flex gap-1.5 mb-3">
            {[-5, -3, -1, 0, 3, 7, 14, 30].map(d => {
              const trig = new Date(inv.dueDate); trig.setDate(trig.getDate() + d)
              const past = trig <= new Date()
              return <div key={d} className={`flex-1 h-1.5 rounded ${past ? 'bg-brand' : 'bg-gray-200'}`} title={`${d > 0 ? '+' : ''}${d} days`} />
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendNow.mutate(inv.id)} className="text-xs px-3 py-1.5 bg-brand text-white rounded">Send now</button>
            <button onClick={() => stop.mutate(inv.id)} className="text-xs px-3 py-1.5 border border-gray-200 rounded">Stop reminders</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityLogTab() {
  const log = useReminderLog()
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h3 className="font-semibold text-sm mb-3">Activity log</h3>
      {log.isLoading ? <div className="text-xs text-gray-400">Loading…</div> :
        !(log.data ?? []).length ? <div className="text-xs text-gray-400 py-6 text-center">No activity yet</div> :
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {(log.data ?? []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${l.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-mono text-gray-500">{l.invoice?.invoiceNumber}</span>
                  <span className="text-gray-600">— {l.schedule?.label}</span>
                </div>
                <div className="text-gray-500">{fmtDateTime(l.sentAt)} · {l.channel}</div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

function SettingsTab() {
  const schedule = useReminderSchedule()
  const toggle = useToggleScheduleStep()
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Step toggles</h3>
        <div className="space-y-2">
          {(schedule.data ?? []).map((s: any) => (
            <label key={s.id} className="flex items-center justify-between text-sm">
              <span>{s.label}</span>
              <input type="checkbox" checked={s.active} onChange={() => toggle.mutate({ id: s.id, active: !s.active })} />
            </label>
          ))}
        </div>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Channels</h3>
        <label className="flex items-center gap-2 text-sm py-1"><input type="checkbox" defaultChecked /> WhatsApp</label>
        <label className="flex items-center gap-2 text-sm py-1"><input type="checkbox" defaultChecked /> Email</label>
      </div>
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Escalation</h3>
        <div className="text-xs text-gray-600">Auto-escalate to admin after <input type="number" defaultValue={30} className="border border-gray-200 rounded px-2 py-1 w-16 text-xs ml-2" /> days overdue.</div>
      </div>
    </div>
  )
}

export default function RemindersPage() {
  const [tab, setTab] = useState<'schedule' | 'invoice' | 'log' | 'settings'>('schedule')
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Reminders</h1>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {[
          { k: 'schedule', label: 'Schedule' },
          { k: 'invoice',  label: 'Per invoice' },
          { k: 'log',      label: 'Activity log' },
          { k: 'settings', label: 'Settings' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t.k ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'invoice'  && <PerInvoiceTab />}
      {tab === 'log'      && <ActivityLogTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
