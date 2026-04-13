'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function getSessionId(): string {
  let id = sessionStorage.getItem('lf_sid')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('lf_sid', id)
  }
  return id
}

export default function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Fire-and-forget — never block the UI
    try {
      const sessionId = getSessionId()
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          path: pathname,
          referrer: document.referrer || null,
        }),
      }).catch(() => {/* silent */})
    } catch {/* silent */}
  }, [pathname])

  return null
}
