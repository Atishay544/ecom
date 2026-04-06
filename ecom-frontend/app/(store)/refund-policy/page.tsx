import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund & Returns Policy',
  description: 'Learn about our 30-day return policy, refund process, and eligibility criteria.',
}

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-2">Last updated: April 2026</p>
        <h1 className="text-3xl font-bold text-gray-900">Refund &amp; Returns Policy</h1>
      </div>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">30-Day Return Window</h2>
          <p>We want you to be completely happy with your purchase. If you're not satisfied for any reason, you may return most items within <strong>30 days</strong> of the delivery date for a full refund or exchange.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Eligibility</h2>
          <p>To be eligible for a return, your item must meet all of the following conditions:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Unused, unworn, and in the same condition you received it</li>
            <li>In the original packaging with all tags attached</li>
            <li>Returned within 30 days of delivery</li>
            <li>Accompanied by proof of purchase (order ID)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Non-Returnable Items</h2>
          <p>The following items cannot be returned:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Perishable goods (food, flowers)</li>
            <li>Intimate apparel or swimwear (for hygiene reasons)</li>
            <li>Digital downloads or software</li>
            <li>Gift cards</li>
            <li>Items marked "Final Sale" at the time of purchase</li>
            <li>Customised or personalised products</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Initiate a Return</h2>
          <ol className="list-decimal pl-5 space-y-2 mt-2">
            <li>Log in to your account and go to <Link href="/account/orders" className="text-black underline underline-offset-2">My Orders</Link>.</li>
            <li>Select the order and click <strong>"Request Return"</strong>.</li>
            <li>Select the item(s) and reason for return.</li>
            <li>We'll email you a prepaid return label within 24 hours.</li>
            <li>Pack the item securely and drop it at the nearest courier point.</li>
          </ol>
          <p className="mt-3">Alternatively, <Link href="/contact" className="text-black underline underline-offset-2">contact our support team</Link> and we'll guide you through the process.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Refund Processing</h2>
          <p>Once we receive and inspect the returned item:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>We'll notify you by email of the approval or rejection.</li>
            <li>Approved refunds are processed within <strong>3–5 business days</strong>.</li>
            <li>Refunds are credited to the original payment method.</li>
            <li>Bank processing may take an additional 2–7 business days depending on your bank.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Damaged or Defective Items</h2>
          <p>If you received a damaged, defective, or incorrect item, please <Link href="/contact" className="text-black underline underline-offset-2">contact us within 48 hours</Link> of delivery with photos of the item. We will arrange a replacement or full refund at no cost to you.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Exchanges</h2>
          <p>We offer exchanges for a different size or colour of the same product, subject to availability. To request an exchange, follow the same return process and indicate "Exchange" as the reason.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Return Shipping Costs</h2>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Defective / wrong item:</strong> We cover return shipping 100%.</li>
            <li><strong>Change of mind:</strong> A flat return shipping fee of $99 is deducted from your refund.</li>
          </ul>
        </section>

        <div className="border-t border-gray-200 pt-6 mt-8">
          <p className="text-sm text-gray-500">Questions? <Link href="/contact" className="text-black underline underline-offset-2">Contact our support team</Link> — we typically respond within 4 business hours.</p>
        </div>
      </div>
    </div>
  )
}
