'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string>('customer')
  const [loading, setLoading] = useState(true)

  // Read role from JWT claims first — no DB round-trip.
  // Falls back to profiles table only if JWT doesn't carry the role.
  async function resolveRole(u: User) {
    const jwtRole = u.app_metadata?.role ?? (u as any).user_metadata?.role
    if (jwtRole) { setRole(jwtRole); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.id)
        .single()
      if (!error && data?.role) setRole(data.role)
    } catch {
      // Silently fall back to 'customer'
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user ?? null
      setUser(u)
      if (u) resolveRole(u)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) resolveRole(u)
      else setRole('customer')
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setRole('customer')
  }

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  return { user, role, isAdmin: role === 'admin', loading, signOut, getToken }
}
