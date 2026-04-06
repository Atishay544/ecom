import { sendEmail, FROM } from '../lib/mailer'

export async function sendOrderConfirmation(to: string, order: any) {
  const items = order.order_items?.map((i: any) =>
    `<tr><td>${i.snapshot?.name}</td><td>${i.quantity}</td><td>₹${i.unit_price}</td><td>₹${i.total}</td></tr>`
  ).join('') ?? ''

  await sendEmail({
    from: FROM.orders, to,
    subject: `Order Confirmed #${order.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Thank you for your order!</h2>
      <p>Order ID: <strong>${order.id.slice(0, 8).toUpperCase()}</strong></p>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${items}
      </table>
      <p>Subtotal: ₹${order.subtotal} | Shipping: ₹${order.shipping} | <strong>Total: ₹${order.total}</strong></p>
      <p>We'll notify you when your order ships.</p>
    `,
  })
}

export async function sendPaymentSuccess(to: string, order: any) {
  await sendEmail({
    from: FROM.orders, to,
    subject: `Payment Successful — Order #${order.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Payment Received!</h2>
      <p>Your payment of <strong>₹${order.total}</strong> was successful.</p>
      <p>Order ID: ${order.id.slice(0, 8).toUpperCase()}</p>
      <p>Razorpay Payment ID: ${order.razorpay_payment_id}</p>
    `,
  })
}

export async function sendOrderShipped(to: string, order: any) {
  await sendEmail({
    from: FROM.orders, to,
    subject: `Your Order Has Shipped! #${order.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Your order is on its way!</h2>
      <p>Order ID: ${order.id.slice(0, 8).toUpperCase()}</p>
      ${order.tracking_number ? `
        <p>Tracking Number: <strong>${order.tracking_number}</strong></p>
        ${order.tracking_url ? `<p><a href="${order.tracking_url}">Track Your Package</a></p>` : ''}
      ` : ''}
    `,
  })
}

export async function sendOrderDelivered(to: string, order: any) {
  await sendEmail({
    from: FROM.orders, to,
    subject: `Order Delivered #${order.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Your order has been delivered!</h2>
      <p>Order ID: ${order.id.slice(0, 8).toUpperCase()}</p>
      <p>We hope you love your purchase. Please leave a review!</p>
    `,
  })
}

export async function sendRefundProcessed(to: string, order: any, amount: number) {
  await sendEmail({
    from: FROM.orders, to,
    subject: `Refund Processed — Order #${order.id.slice(0, 8).toUpperCase()}`,
    html: `
      <h2>Refund Processed</h2>
      <p>A refund of <strong>₹${amount}</strong> has been initiated for Order #${order.id.slice(0, 8).toUpperCase()}.</p>
      <p>It will reflect in your account within 5-7 business days.</p>
    `,
  })
}

export async function sendOtpEmail(to: string, otp: string) {
  await sendEmail({
    from: FROM.noreply, to,
    subject: 'Your Login OTP',
    html: `
      <h2>Your One-Time Password</h2>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p>
      <p>This OTP expires in 10 minutes. Do not share it with anyone.</p>
    `,
  })
}

export async function sendWelcomeEmail(to: string, name: string) {
  await sendEmail({
    from: FROM.noreply, to,
    subject: 'Welcome to the store!',
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Your account has been created. Start shopping now!</p>
    `,
  })
}
