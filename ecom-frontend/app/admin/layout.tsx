import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AdminNav from './AdminNav'
import { requireAdmin } from '@/lib/admin-auth'

// Admin pages are always authenticated — never statically generate them
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // requireAdmin is React cache() — shared with page, only 1 DB round trip per request
  const { user, profile } = await requireAdmin()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar — fixed to viewport height, never scrolls with page content */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0 h-full">
        <div className="px-6 py-5 border-b border-gray-800">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Admin Portal</p>
          <p className="text-sm font-semibold text-white truncate">{profile.full_name ?? user.email}</p>
        </div>

        <AdminNav />

        <div className="px-6 py-4 border-t border-gray-800">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} className="shrink-0" />
            Back to Store
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
