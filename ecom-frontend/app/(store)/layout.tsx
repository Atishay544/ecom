import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/admin'
import Header from '@/components/storefront/Header'
import Footer from '@/components/storefront/Footer'
import AnnouncementBar from '@/components/storefront/AnnouncementBar'
import ChatWidgetLoader from '@/components/chat/ChatWidgetLoader'

// Cached for 60s — categories/announcements rarely change
const getLayoutData = unstable_cache(
  async () => {
    // Guard: skip DB call at build time if env vars are not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { announcement: null, categories: [] }
    }
    const supabase = createPublicClient()
    const now = new Date().toISOString()
    const [{ data: announcements }, { data: categoriesRaw }] = await Promise.all([
      supabase
        .from('announcements')
        .select('id,message,bg_color,text_color,link_url,link_text,is_active')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('categories')
        .select('id,name,slug,parent_id,sort_order')
        .order('sort_order'),
    ])
    const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string; parent_id: string | null; sort_order: number | null }[]
    return { announcement: announcements?.[0] ?? null, categories }
  },
  ['layout-data'],
  { revalidate: 3600, tags: ['announcements', 'categories'] }
)

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { announcement, categories } = await getLayoutData()

  // Build category tree
  const map = new Map<string, any>()
  const roots: any[] = []
  categories.forEach(c => map.set(c.id, { ...c, children: [] }))
  categories.forEach(c => {
    if (c.parent_id) map.get(c.parent_id)?.children.push(map.get(c.id))
    else roots.push(map.get(c.id))
  })

  return (
    <div className="min-h-screen flex flex-col">
      {announcement && <AnnouncementBar data={announcement} />}
      <Header categories={roots} />
      <main className="flex-1">{children}</main>
      <Footer categories={roots} />
      <ChatWidgetLoader />
    </div>
  )
}
