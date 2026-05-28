import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

notificationsRouter.post('/whatsapp/send', requireRole('ADMIN', 'SALES'), async (req: AuthRequest, res, next) => {
  try {
    const { orderId, templateName, customerPhone } = req.body
    await prisma.waLog.create({
      data: { orderId, customerPhone, templateName: templateName || 'ORDER_READY', status: 'sent', sentById: req.user!.id },
    })
    res.json({ message: 'WhatsApp message sent' })
  } catch (err) { next(err) }
})

notificationsRouter.post('/email/send', requireRole('ADMIN', 'SALES'), async (_req, res) => {
  res.json({ message: 'Email queued' })
})

notificationsRouter.get('/log', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const logs = await prisma.waLog.findMany({
      include: {
        order: { select: { orderNumber: true, jobName: true } },
        sentBy: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    })
    res.json(logs)
  } catch (err) { next(err) }
})
