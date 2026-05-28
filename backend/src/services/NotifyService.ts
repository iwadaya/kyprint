import nodemailer from 'nodemailer'
import { prisma } from '../prisma/client'

const wa = {
  phoneId: process.env.WA_PHONE_NUMBER_ID,
  token: process.env.WA_ACCESS_TOKEN,
}

let mailer: nodemailer.Transporter | null = null
function getMailer() {
  if (mailer) return mailer
  if (!process.env.SMTP_HOST) return null
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! } : undefined,
  })
  return mailer
}

export const NotifyService = {
  async sendWhatsApp(phone: string, templateName: string, variables: Record<string, string>) {
    if (!wa.phoneId || !wa.token) {
      console.log(`[NotifyService.whatsapp] Skipped (no creds) → ${phone} / ${templateName}`, variables)
      return { ok: false, skipped: true }
    }
    const url = `https://graph.facebook.com/v18.0/${wa.phoneId}/messages`
    const body = {
      messaging_product: 'whatsapp',
      to: phone.replace(/[^\d+]/g, ''),
      type: 'template',
      template: {
        name: templateName.toLowerCase(),
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: Object.values(variables).map(v => ({ type: 'text', text: String(v) })),
        }],
      },
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('[NotifyService.whatsapp] error', data)
        return { ok: false, error: data }
      }
      return { ok: true, data }
    } catch (err) {
      console.error('[NotifyService.whatsapp] threw', err)
      return { ok: false, error: err }
    }
  },

  async sendEmail(to: string, subject: string, html: string) {
    const m = getMailer()
    if (!m) {
      console.log(`[NotifyService.email] Skipped (no SMTP) → ${to} / ${subject}`)
      return { ok: false, skipped: true }
    }
    try {
      const info = await m.sendMail({
        from: `${process.env.EMAIL_FROM_NAME || 'PrintShop Pro'} <${process.env.EMAIL_FROM!}>`,
        to, subject, html,
      })
      return { ok: true, messageId: info.messageId }
    } catch (err) {
      console.error('[NotifyService.email] threw', err)
      return { ok: false, error: err }
    }
  },

  async notifyStaffOnPayment(invoiceId: string, message: string) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true } })
    for (const a of admins) {
      await prisma.notificationLog.create({
        data: { invoiceId, userId: a.id, eventType: 'PAYMENT_RECEIVED', message },
      })
      if (a.email) await NotifyService.sendEmail(a.email, 'Payment received', `<p>${message}</p>`)
    }
  },
}
