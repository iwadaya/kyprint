import cron from 'node-cron'
import { prisma } from '../prisma/client'
import { NotifyService } from '../services/NotifyService'

export function startReminderScheduler() {
  const cronExpr = process.env.REMINDER_CRON || '0 8 * * 1-5'

  cron.schedule(cronExpr, async () => {
    console.log('[ReminderScheduler] Running daily reminder job...')
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const unpaidInvoices = await prisma.invoice.findMany({
        where: { status: { in: ['UNPAID', 'SENT', 'OVERDUE'] } },
        include: {
          customer: true,
          order: true,
          reminderLogs: { where: { sentAt: { gte: new Date(todayStr) } } },
        },
      })

      const scheduleSteps = await prisma.reminderSchedule.findMany({
        where: { active: true },
      })

      let sent = 0

      for (const invoice of unpaidInvoices) {
        for (const step of scheduleSteps) {
          const triggerDate = new Date(invoice.dueDate)
          triggerDate.setDate(triggerDate.getDate() + step.daysOffset)
          const triggerStr = triggerDate.toISOString().split('T')[0]

          if (triggerStr !== todayStr) continue

          // Skip if already sent today for this step
          const alreadySent = invoice.reminderLogs.some(l => l.scheduleId === step.id)
          if (alreadySent) continue

          // Skip weekends
          const dayOfWeek = today.getDay()
          if (dayOfWeek === 0 || dayOfWeek === 6) continue

          const channels = step.channels as string[]

          for (const channel of channels) {
            const vars = {
              customer_name: invoice.customer.name,
              invoice_number: invoice.invoiceNumber,
              amount: String(invoice.amount),
              due_date: invoice.dueDate.toISOString().slice(0, 10),
              bank_details: 'Standard Bank · 012345678',
            }
            let result: { ok: boolean }
            if (channel === 'wa') {
              result = await NotifyService.sendWhatsApp(invoice.customer.phone, 'PAYMENT_REMINDER', vars)
            } else {
              const html = `<p>Hi ${vars.customer_name},</p><p>Friendly reminder that invoice <b>${vars.invoice_number}</b> for ${vars.amount} is due on ${vars.due_date}.</p>`
              result = await NotifyService.sendEmail(invoice.customer.email, `Reminder: invoice ${vars.invoice_number}`, html)
            }
            await prisma.reminderLog.create({
              data: {
                invoiceId: invoice.id,
                scheduleId: step.id,
                channel,
                status: result.ok ? 'sent' : 'failed',
              },
            })
            sent++
          }

          // Update invoice to OVERDUE if past due date
          if (step.daysOffset > 0 && invoice.status !== 'OVERDUE') {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'OVERDUE' },
            })
          }
        }
      }

      console.log(`[ReminderScheduler] Done. ${sent} reminders sent.`)
    } catch (err) {
      console.error('[ReminderScheduler] Error:', err)
    }
  }, {
    timezone: process.env.TIMEZONE || 'Africa/Johannesburg',
  })

  console.log(`[ReminderScheduler] Scheduled — cron: ${cronExpr}`)
}
