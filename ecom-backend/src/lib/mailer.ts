import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

type EmailOptions = { to: string; subject: string; html: string; from?: string }

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  return transporter.sendMail({
    from: from ?? `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to, subject, html,
  })
}

export const FROM = {
  orders:  `"Orders" <${process.env.ORDERS_EMAIL}>`,
  support: `"Support" <${process.env.SUPPORT_EMAIL}>`,
  noreply: `"${process.env.SMTP_FROM_NAME}" <${process.env.NOREPLY_EMAIL}>`,
}
