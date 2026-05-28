import { Router } from 'express'
import { prisma } from '../prisma/client'
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth'

export const quotesRouter = Router()
quotesRouter.use(requireAuth)

async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.quote.count()
  return `QT-${year}-${String(count + 1).padStart(3, '0')}`
}

quotesRouter.get('/', async (_req, res, next) => {
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        capturedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(quotes)
  } catch (err) { next(err) }
})

quotesRouter.post('/', requireRole('ADMIN', 'SALES'), async (req: AuthRequest, res, next) => {
  try {
    const quoteNumber = await nextQuoteNumber()
    const quote = await prisma.quote.create({ data: { ...req.body, quoteNumber } })
    res.status(201).json(quote)
  } catch (err) { next(err) }
})

quotesRouter.put('/:id', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const quote = await prisma.quote.update({ where: { id: req.params.id }, data: req.body })
    res.json(quote)
  } catch (err) { next(err) }
})

quotesRouter.post('/:id/convert', requireRole('ADMIN', 'SALES'), async (req, res, next) => {
  try {
    const quote = await prisma.quote.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
    })
    res.json({ message: 'Quote accepted — create order from this quote', quote })
  } catch (err) { next(err) }
})
