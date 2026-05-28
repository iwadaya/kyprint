import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const remindersRouter = Router()
remindersRouter.use(requireAuth)

remindersRouter.get('/schedule', async (_req, res, next) => {
  try {
    res.json(await prisma.reminderSchedule.findMany({ orderBy: { daysOffset: 'asc' } }))
  } catch (err) { next(err) }
})

remindersRouter.post('/schedule', requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.status(201).json(await prisma.reminderSchedule.create({ data: req.body }))
  } catch (err) { next(err) }
})

remindersRouter.put('/schedule/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.json(await prisma.reminderSchedule.update({ where: { id: req.params.id }, data: req.body }))
  } catch (err) { next(err) }
})

remindersRouter.get('/upcoming', async (_req, res, next) => {
  try {
    const today = new Date()
    const in7 = new Date(today.getTime() + 7 * 86400000)
    const unpaid = await prisma.invoice.findMany({
      where: { status: { in: ['UNPAID', 'SENT', 'OVERDUE'] } },
      include: { customer: { select: { name: true, phone: true, email: true } } },
    })
    const schedule = await prisma.reminderSchedule.findMany({ where: { active: true } })
    const upcoming: any[] = []
    for (const inv of unpaid) {
      for (const step of schedule) {
        const d = new Date(inv.dueDate)
        d.setDate(d.getDate() + step.daysOffset)
        if (d >= today && d <= in7) upcoming.push({ invoice: inv, step, triggerDate: d })
      }
    }
    upcoming.sort((a, b) => a.triggerDate - b.triggerDate)
    res.json(upcoming)
  } catch (err) { next(err) }
})

remindersRouter.get('/log', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    res.json(await prisma.reminderLog.findMany({
      include: { invoice: { select: { invoiceNumber: true } }, schedule: true },
      orderBy: { sentAt: 'desc' },
      take: 200,
    }))
  } catch (err) { next(err) }
})

remindersRouter.post('/send-now/:invoiceId', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId }, include: { customer: true } })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    const firstStep = await prisma.reminderSchedule.findFirst()
    if (firstStep) {
      await prisma.reminderLog.create({ data: { invoiceId: invoice.id, scheduleId: firstStep.id, channel: 'manual', status: 'sent' } })
    }
    res.json({ message: 'Reminder sent', invoiceId: invoice.id })
  } catch (err) { next(err) }
})

remindersRouter.patch('/stop/:invoiceId', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    await prisma.notificationLog.create({
      data: {
        invoiceId: req.params.invoiceId,
        userId: (req as AuthRequest).user!.id,
        eventType: 'REMINDERS_STOPPED',
        message: 'Reminders manually stopped',
      },
    })
    res.json({ message: 'Reminders stopped', invoiceId: req.params.invoiceId })
  } catch (err) { next(err) }
})
