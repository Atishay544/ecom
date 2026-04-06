'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Props {
  productId: string
  isActive: boolean
  productName: string
}

export default function ProductActions({ productId, isActive, productName }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function toggleActive() {
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: !isActive })
      .eq('id', productId)
    setBusy(false)
    if (err) { setError(err.message); return }
    router.refresh()
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    const { error: err } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
    setBusy(false)
    setBusy(false)
    setShowConfirm(false)
    if (err) { setError(err.message); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 justify-end">
        <Link
          href={`/admin/products/${productId}`}
          className="text-xs text-blue-600 hover:underline px-2 py-1"
        >
          Edit
        </Link>
        <button
          onClick={toggleActive}
          disabled={busy}
          className={`text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40 ${
            isActive
              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              : 'text-green-700 bg-green-50 hover:bg-green-100'
          }`}
        >
          {busy ? '…' : isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={busy}
          className="text-xs text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors disabled:opacity-40"
        >
          Delete
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-red-500 max-w-[200px] text-right">{error}</p>
      )}
      {showConfirm && (
        <ConfirmModal
          message={`Delete "${productName}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
          loading={busy}
        />
      )}
    </div>
  )
}
