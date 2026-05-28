import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { authRouter } from './routes/auth'
import { customersRouter } from './routes/customers'
import { ordersRouter } from './routes/orders'
import { quotesRouter } from './routes/quotes'
import { invoicesRouter } from './routes/invoices'
import { paymentsRouter } from './routes/payments'
import { proofsRouter } from './routes/proofs'
import { deliveriesRouter } from './routes/deliveries'
import { stockRouter } from './routes/stock'
import { notificationsRouter } from './routes/notifications'
import { remindersRouter } from './routes/reminders'
import { errorHandler } from './middleware/errorHandler'
import { startReminderScheduler } from './jobs/reminderJob'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(morgan('combined'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/auth',          authRouter)
app.use('/api/customers',     customersRouter)
app.use('/api/orders',        ordersRouter)
app.use('/api/quotes',        quotesRouter)
app.use('/api/invoices',      invoicesRouter)
app.use('/api/payments',      paymentsRouter)
app.use('/api/proofs',        proofsRouter)
app.use('/api/deliveries',    deliveriesRouter)
app.use('/api/stock',         stockRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reminders',     remindersRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`PrintShop Pro API running on port ${PORT}`)
  startReminderScheduler()
})

function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received, closing server…`)
  server.close(() => {
    console.log('[shutdown] HTTP server closed.')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default app
