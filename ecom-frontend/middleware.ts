import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that require a logged-in user
// Admin role check is intentionally NOT done here — Edge Runtime does not support
// @supabase/supabase-js createClient (uses Node.js crypto). Role check happens in
// app/admin/layout.tsx which runs in Node.js runtime with full API access.
const PROTECTED = ['/account', '/checkout', '/wishlist', '/admin']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Block attack paths
  const blockedPaths = ['/wp-admin', '/wp-login', '/phpmyadmin', '/.env', '/admin.php', '/xmlrpc.php']
  if (blockedPaths.some(p => pathname.startsWith(p))) return new NextResponse(null, { status: 404 })

  // Block scanner UAs
  const ua = req.headers.get('user-agent') ?? ''
  const badAgents = ['sqlmap', 'nikto', 'masscan', 'nmap', 'dirbuster', 'gobuster']
  if (badAgents.some(b => ua.toLowerCase().includes(b))) return new NextResponse(null, { status: 403 })

  // Build a response we can attach cookies to
  let response = NextResponse.next({ request: req })

  // Use @supabase/ssr (Edge-compatible) — anon key only, no Node.js APIs
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session cookies — this is the primary job of middleware
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  // For /admin: only checks that a user is logged in.
  // The admin role check (admin vs non-admin) is enforced in app/admin/layout.tsx.
  const needsAuth = PROTECTED.some(p => pathname.startsWith(p))
  if (needsAuth && !user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
