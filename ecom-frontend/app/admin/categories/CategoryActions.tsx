'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  categoryId: string
  categoryName: string
}

export default function CategoryActions({ categoryId, categoryName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleDelete() {
    setLoading(true)
    await supabase.from('categories').delete().eq('id', categoryId)
    setLoading(false)
    setShowConfirm(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setShowConfirm(true)} className="text-xs text-red-600 hover:underline">
        Delete
      </button>

      {showConfirm && (
        <ConfirmModal
          message={`Are you sure you want to delete "${categoryName}"? Products in this category will be uncategorized.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          loading={loading}
        />
      )}
    </>
  )
}
