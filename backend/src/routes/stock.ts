import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole } from '../middleware/auth'

export const stockRouter = Router()
stockRouter.use(requireAuth)

stockRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({ orderBy: { name: 'asc' } })
    res.json(items)
  } catch (err) { next(err) }
})

stockRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const item = await prisma.stockItem.create({ data: req.body })
    res.status(201).json(item)
  } catch (err) { next(err) }
})

stockRouter.patch('/:id/adjust', requireRole('ADMIN', 'PRESS_OPERATOR'), async (req, res, next) => {
  try {
    const item = await prisma.stockItem.update({ where: { id: req.params.id }, data: { quantity: req.body.quantity } })
    res.json(item)
  } catch (err) { next(err) }
})

stockRouter.get('/alerts', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany()
    res.json(items.filter(i => i.quantity <= i.minLevel))
  } catch (err) { next(err) }
})
