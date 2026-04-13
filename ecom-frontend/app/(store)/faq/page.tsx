'use client'

import type { Metadata } from 'next'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    category: 'Orders',
    items: [
      {
        q: 'How do I track my order?',
        a: 'Log in to your account and go to My Orders. Click on any order to see its live status and tracking number. You can also ask our chat assistant — just type "track my order" and it will pull up your latest order details instantly.',
      },
      {
        q: 'Can I change or cancel my order after placing it?',
        a: 'Orders can be cancelled within 1 hour of placement if they haven\'t been dispatched yet. Go to My Orders → Order Detail → Cancel. For changes after 1 hour, please contact our support team as soon as possible.',
      },
      {
        q: 'I placed an order but didn\'t receive a confirmation email. What should I do?',
        a: 'Check your spam/junk folder first. If you still can\'t find it, log in to your account — if the order appears in My Orders, it was placed successfully. Contact us if the email still doesn\'t arrive.',
      },
      {
        q: 'Can I order without creating an account?',
        a: 'Currently, an account is required to place orders so we can send you tracking updates and manage returns easily. Registration takes less than a minute using your email or phone number.',
      },
    ],
  },
  {
    category: 'Shipping & Delivery',
    items: [
      {
        q: 'How long does delivery take?',
        a: 'Metro cities: 1–3 business days. Tier-2/3 cities: 3–5 business days. Remote areas: 5–8 business days. See our full Shipping Policy for details.',
      },
      {
        q: 'Is shipping free?',
        a: 'Yes! Shipping is free on all orders above ₹499. Orders below ₹499 have a flat shipping fee of ₹49.',
      },
      {
        q: 'Do you ship outside India?',
        a: 'Currently we only ship within India. International shipping is on our roadmap — stay tuned!',
      },
      {
        q: 'What if I miss the delivery?',
        a: 'Our courier partner will make up to 3 delivery attempts. After 3 missed attempts, the package is returned to us and we\'ll contact you to rearrange delivery.',
      },
    ],
  },
  {
    category: 'Returns & Refunds',
    items: [
      {
        q: 'What is your return policy?',
        a: 'We offer a 30-day return window for unused items in original packaging. See our full Refund & Returns Policy for details.',
      },
      {
        q: 'How long does a refund take?',
        a: 'Once we receive and inspect the returned item, refunds are processed within 3–5 business days and credited to your original payment method. Your bank may take an additional 2–7 days.',
      },
      {
        q: 'I received a damaged / wrong item. What do I do?',
        a: 'Contact us within 48 hours of delivery with a photo of the item. We will send a replacement or issue a full refund — no return shipping cost to you.',
      },
    ],
  },
  {
    category: 'Payments',
    items: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit and debit cards (Visa, Mastercard, RuPay), UPI (GPay, PhonePe, Paytm), and net banking — all processed securely by Razorpay.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. We never store your card details. All payment processing is handled by Razorpay with PCI-DSS compliance and SSL encryption.',
      },
      {
        q: 'My payment failed but money was deducted. What now?',
        a: 'This sometimes happens due to network issues. The amount is automatically refunded to your account within 5–7 business days by your bank. If it doesn\'t, contact us with the transaction ID and we\'ll help resolve it.',
      },
    ],
  },
  {
    category: 'Account & Profile',
    items: [
      {
        q: 'How do I reset my password?',
        a: 'Go to the Login page and click "Forgot Password". Enter your email and we\'ll send you a reset link.',
      },
      {
        q: 'How do I update my address?',
        a: 'Log in → Account → Addresses. You can add, edit, or delete saved addresses at any time.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Contact our support team with your account email and request deletion. We\'ll process it within 7 business days.',
      },
    ],
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 group"
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900 group-hover:text-black">{question}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-gray-600 text-sm leading-relaxed pr-6">{answer}</p>
      )}
    </div>
  )
}

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
        <p className="text-gray-600 mt-3">Can't find what you're looking for? <Link href="/contact" className="text-black underline underline-offset-2">Contact us</Link> and we'll help.</p>
      </div>

      <div className="space-y-8">
        {FAQS.map(section => (
          <div key={section.category}>
            <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-2">{section.category}</h2>
            <div className="bg-white rounded-2xl border border-gray-200 px-5">
              {section.items.map(item => (
                <FaqItem key={item.q} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-gray-50 rounded-2xl p-6 text-center">
        <p className="font-semibold text-gray-900 mb-1">Still have questions?</p>
        <p className="text-gray-600 text-sm mb-4">Our support team is available Mon–Sat, 10am–7pm IST.</p>
        <Link href="/contact"
          className="inline-block bg-black text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800 transition">
          Contact Support
        </Link>
      </div>
    </div>
  )
}
