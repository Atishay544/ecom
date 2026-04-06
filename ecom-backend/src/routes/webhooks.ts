import { Router, Request, Response } from 'express'
import { verifyWebhookSignature } from '../lib/razorpay'
import { supabase } from '../lib/supabase'
import { sendPaymentSuccess, sendOrderShipped, sendOrderDelivered, sendRefundProcessed } from '../services/emails'

const router = Router()

// POST /api/webhooks/razorpay — raw body required
router.post('/razorpay', async (req: Request, res: Response) => {
  const signature = req.headers['x-razorpay-signature'] as string
  const rawBody = JSON.stringify(req.body)

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const event = req.body.event
  const payload = req.body.payload

  try {
    if (event === 'payment.captured') {
      const paymentId = payload.payment.entity.id
      const orderId   = payload.payment.entity.order_id

      // Update order
      const { data: order } = await supabase.from('orders')
        .update({ status: 'confirmed', razorpay_payment_id: paymentId, updated_at: new Date().toISOString() })
        .eq('razorpay_order_id', orderId).select('*, order_items(*)').single()

      if (order) {
        // Get user email
        const { data: { user } } = await supabase.auth.admin.getUserById(order.user_id)
        if (user?.email) {
          await sendPaymentSuccess(user.email, order)
        }
        // Create notification
        await supabase.from('notifications').insert({
          user_id: order.user_id,
          type: 'order_update',
          title: 'Payment Successful',
          body: `Your payment for Order #${order.id.slice(0, 8).toUpperCase()} was received.`,
          link: `/account/orders/${order.id}`,
        })
      }
    }

    if (event === 'payment.failed') {
      const orderId = payload.payment.entity.order_id
      await supabase.from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('razorpay_order_id', orderId)
    }

    if (event === 'refund.processed') {
      const paymentId = payload.refund.entity.payment_id
      const amount    = payload.refund.entity.amount / 100

      const { data: order } = await supabase.from('orders')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('razorpay_payment_id', paymentId).select().single()

      if (order) {
        const { data: { user } } = await supabase.auth.admin.getUserById(order.user_id)
        if (user?.email) await sendRefundProcessed(user.email, order, amount)
      }
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error('[Webhook]', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
