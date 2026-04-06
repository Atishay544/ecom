'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  categoryId: string
  categoryName: string
}

export default function CategoryActions({ categoryId, categoryName }: Props) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleDelete() {
    if (!confirm(`Delete category "${categoryName}"? Products in this category will be uncategorized.`)) return
    await supabase.from('categories').delete().eq('id', categoryId)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-red-600 hover:underline"
    >
      Delete
    </button>
  )
}
