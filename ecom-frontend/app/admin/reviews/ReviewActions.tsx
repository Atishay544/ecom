'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  reviewId: string
  isApproved: boolean
  isRejected: boolean
}

export default function ReviewActions({ reviewId, isApproved, isRejected }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function approve() {
    setLoading(true)
    await supabase
      .from('reviews')
      .update({ is_approved: true, is_rejected: false })
      .eq('id', reviewId)
    setLoading(false)
    router.refresh()
  }

  async function reject() {
    setLoading(true)
    await supabase
      .from('reviews')
      .update({ is_approved: false, is_rejected: true })
      .eq('id', reviewId)
    setLoading(false)
    router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    await supabase.from('reviews').delete().eq('id', reviewId)
    setLoading(false)
    setShowConfirm(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {!isApproved && (
        <button
          onClick={approve}
          disabled={loading}
          className="text-xs text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
      )}
      {!isRejected && (
        <button
          onClick={reject}
          disabled={loading}
          className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      )}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
      >
        Delete
      </button>
      {showConfirm && (
        <ConfirmModal
          message="Delete this review permanently? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          loading={loading}
        />
      )}
    </div>
  )
}
