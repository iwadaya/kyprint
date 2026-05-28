import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole } from '../middleware/auth'

export const deliveriesRouter = Router()
deliveriesRouter.use(requireAuth)

deliveriesRouter.get('/', async (req, res, next) => {
  try {
    const { date, driverId } = req.query
    const where: any = {}
    if (date) where.deliveryDate = { gte: new Date(date as string) }
    if (driverId) where.driverId = driverId
    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, jobName: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { deliveryDate: 'asc' },
    })
    res.json(deliveries)
  } catch (err) { next(err) }
})

deliveriesRouter.post('/', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const delivery = await prisma.delivery.create({ data: req.body })
    res.status(201).json(delivery)
  } catch (err) { next(err) }
})

deliveriesRouter.patch('/:id/delivered', requireRole('ADMIN', 'DRIVER'), async (req, res, next) => {
  try {
    const delivery = await prisma.delivery.update({ where: { id: req.params.id }, data: { status: 'DELIVERED' } })
    res.json(delivery)
  } catch (err) { next(err) }
})
