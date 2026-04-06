'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  categoryId: string
  categoryName: string
}

export default function CategoryActions({ categoryId, categoryName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: categoryId }),
    })
    setLoading(false)
    setShowConfirm(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setShowConfirm(true)} className="text-xs text-red-600 hover:underline">
        Delete
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
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
