import nodemailer from 'nodemailer'

// Lazily created — avoids build-time crash when env vars are absent
function getTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

const FROM = `"${process.env.SMTP_FROM_NAME ?? 'Layers Factory'}" <${process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER}>`

// ─── Shared helpers ─────────────────────────────────────────────────────────

function formatINR(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function orderItemsHtml(items: { name: string; quantity: number; unit_price: number }[]) {
  return items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${formatINR(i.unit_price * i.quantity)}</td>
    </tr>`
  ).join('')
}

function addressText(addr: Record<string, string>) {
  return [addr.name, addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.pincode}`, addr.phone]
    .filter(Boolean).join('<br>')
}

function baseLayout(body: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
  <tr><td style="background:#000;padding:24px 32px">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px">Layers Factory</span>
  </td></tr>
  <tr><td style="padding:32px">${body}</td></tr>
  <tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;text-align:center">
    <p style="margin:0;color:#999;font-size:12px">Layers Factory · Questions? Reply to this email or visit layersfactory.com</p>
  </td></tr>
</table></td></tr></table>
</body></html>`
}

// ─── Customer: Order Confirmation ────────────────────────────────────────────

interface OrderConfirmParams {
  to:             string
  orderId:        string
  items:          { name: string; quantity: number; unit_price: number }[]
  subtotal:       number
  discount:       number
  total:          number
  paymentMethod:  'online' | 'cod' | 'cod_upfront'
  amountCharged?: number
  amountOnDelivery?: number
  shippingAddress: Record<string, string>
}

export async function sendOrderConfirmation(p: OrderConfirmParams) {
  const pmLabel =
    p.paymentMethod === 'cod'         ? 'Cash on Delivery' :
    p.paymentMethod === 'cod_upfront' ? 'COD Upfront Offer' : 'Paid Online'

  const paymentDetail =
    p.paymentMethod === 'cod'
      ? `<p style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;color:#9a3412;margin:16px 0">
           <strong>Cash on Delivery</strong> — please keep <strong>${formatINR(p.total)}</strong> ready at the time of delivery.
         </p>`
      : p.paymentMethod === 'cod_upfront' && p.amountCharged !== undefined
        ? `<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;color:#166534;margin:16px 0">
             Paid upfront: <strong>${formatINR(p.amountCharged)}</strong> &nbsp;|&nbsp;
             Due on delivery: <strong>${formatINR(p.amountOnDelivery ?? 0)}</strong>
           </p>`
        : `<p style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;color:#1e40af;margin:16px 0">
             Payment received online. Thank you!
           </p>`

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;font-size:22px;color:#111">Order Confirmed!</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px">Order #${p.orderId.slice(0,8).toUpperCase()} &nbsp;·&nbsp; ${pmLabel}</p>
    ${paymentDetail}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:20px 0">
      <thead><tr style="background:#f9f9f9">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:600">ITEM</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;font-weight:600">QTY</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;font-weight:600">TOTAL</th>
      </tr></thead>
      <tbody>${orderItemsHtml(p.items)}</tbody>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      ${p.discount > 0 ? `<tr><td style="padding:4px 0;color:#666;font-size:14px">Discount</td><td style="padding:4px 0;text-align:right;color:#16a34a;font-size:14px">-${formatINR(p.discount)}</td></tr>` : ''}
      <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px;border-top:1px solid #eee">Total</td>
          <td style="padding:8px 0 0;text-align:right;font-weight:700;font-size:16px;border-top:1px solid #eee">${formatINR(p.total)}</td></tr>
    </table>
    <div style="background:#f9f9f9;border-radius:8px;padding:16px;font-size:13px;color:#555;line-height:1.6">
      <strong style="display:block;margin-bottom:4px;color:#333">Deliver to</strong>
      ${addressText(p.shippingAddress)}
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#888">We'll notify you once your order is shipped. If you have questions, reply to this email.</p>
  `)

  await getTransport().sendMail({
    from:    FROM,
    to:      p.to,
    subject: `Order Confirmed — #${p.orderId.slice(0,8).toUpperCase()} | Layers Factory`,
    html,
  })
}

// ─── Merchant: New Order Alert ───────────────────────────────────────────────

interface NewOrderAlertParams {
  orderId:       string
  customerEmail: string
  items:         { name: string; quantity: number; unit_price: number }[]
  total:         number
  paymentMethod: string
  shippingAddress: Record<string, string>
}

export async function sendNewOrderAlert(p: NewOrderAlertParams) {
  const html = baseLayout(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#111">New Order Received</h2>
    <p style="margin:0 0 20px;color:#666;font-size:14px">Order #${p.orderId.slice(0,8).toUpperCase()} from ${p.customerEmail}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#555"><strong>Payment:</strong> ${p.paymentMethod} &nbsp;·&nbsp; <strong>Total:</strong> ${formatINR(p.total)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:16px 0">
      <thead><tr style="background:#f9f9f9">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666">ITEM</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#666">QTY</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#666">TOTAL</th>
      </tr></thead>
      <tbody>${orderItemsHtml(p.items)}</tbody>
    </table>
    <div style="background:#f9f9f9;border-radius:8px;padding:14px;font-size:13px;color:#555;line-height:1.6;margin-bottom:20px">
      <strong style="display:block;margin-bottom:4px;color:#333">Ship to</strong>
      ${addressText(p.shippingAddress)}
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${p.orderId}"
       style="display:inline-block;background:#000;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
      View in Admin
    </a>
  `)

  await getTransport().sendMail({
    from:    FROM,
    to:      process.env.ORDERS_EMAIL ?? process.env.SMTP_USER!,
    subject: `New Order #${p.orderId.slice(0,8).toUpperCase()} — ${formatINR(p.total)} (${p.paymentMethod})`,
    html,
  })
}
