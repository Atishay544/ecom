'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string>('customer')
  const [loading, setLoading] = useState(true)

  // Read role from the profiles table safely — catch 500 from circular RLS
  async function fetchRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      if (!error && data?.role) setRole(data.role)
    } catch {
      // Silently fall back to 'customer' — admin check is server-side anyway
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      if (data.user) fetchRole(data.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setRole('customer')
    })
    return () => subscription.unsubscribe()
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
