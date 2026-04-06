import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * React cache() deduplicates this across layout + page within one request.
 * Layout calls it, page calls it — only ONE pair of DB round trips fires.
 * Also parallelizes auth + role check.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createServerClient()

  // Run auth + (if authed) role check in parallel
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/dashboard')

  // Fast-path: role baked into JWT app_metadata — no DB round-trip
  if (user.app_metadata?.role === 'admin') {
    return { user, profile: { role: 'admin', full_name: user.user_metadata?.full_name ?? '' } as any }
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/?error=unauthorized')

  return { user, profile: profile! }
})
