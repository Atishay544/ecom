import { createPublicClient } from '@/lib/supabase/admin'
import { unstable_cache } from 'next/cache'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

const HeroCarousel   = dynamic(() => import('./HeroCarousel'), { ssr: true })
const AnimatedGrid   = dynamic(() => import('./AnimatedSection').then(m => ({ default: m.AnimatedGrid })), { ssr: false, loading: () => <div /> })
const AnimatedItem   = dynamic(() => import('./AnimatedSection').then(m => ({ default: m.AnimatedItem })), { ssr: false, loading: () => <div /> })

export const revalidate = 600

const getStaticHomeData = unstable_cache(
  async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { banners: [], categories: [] }
    }
    const supabase = createPublicClient()
    const [{ data: bannersRaw }, { data: categoriesRaw }] = await Promise.all([
      supabase
        .from('banners')
        .select('id,title,subtitle,image_url,link_url,link_text,bg_color,text_color,sort_order,display_style')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('categories')
        .select('id,name,slug,image_url')
        .is('parent_id', null)
        .order('sort_order')
        .limit(6),
    ])
    type Banner = { id: string; title: string | null; subtitle: string | null; image_url: string | null; link_url: string | null; link_text: string | null; bg_color: string | null; text_color: string | null; sort_order: number | null; display_style: string | null }
    type Category = { id: string; name: string; slug: string; image_url: string | null }
    const banners = (bannersRaw ?? []) as Banner[]
    const categories = (categoriesRaw ?? []) as Category[]
    return { banners, categories }
  },
  ['home-static'],
  { revalidate: 600, tags: ['banners', 'categories'] }
)

type HomeProduct = { id: string; name: string; slug: string; price: number; compare_price: number | null; images: string[] | null }

const getDynamicHomeProducts = unstable_cache(
  async (): Promise<{ featured: HomeProduct[]; deals: HomeProduct[] }> => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { featured: [], deals: [] }
    }
    const supabase = createPublicClient()
    const [{ data: featured }, { data: deals }] = await Promise.all([
      supabase
        .from('products')
        .select('id,name,slug,price,compare_price,images')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('products')
        .select('id,name,slug,price,compare_price,images')
        .eq('is_active', true)
        .not('compare_price', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8),
    ])
    return { featured: featured ?? [], deals: deals ?? [] }
  },
  ['home-products'],
  { revalidate: 600, tags: ['products'] }
)

export default async function HomePage() {
  const { banners, categories } = await getStaticHomeData()
  const { featured, deals } = await getDynamicHomeProducts()

  const heroSlides = banners.filter(b => b.sort_order === 0)
  const dealBanner = banners.find(b => b.sort_order === 1) ?? null

  return (
    <div>
      {/* ── Hero Carousel — full bleed ── */}
      <HeroCarousel banners={heroSlides} />

      {/* ── Categories ── */}
      {categories && categories.length > 0 && (
        <section className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 py-14">
          <SectionHeader title="Shop by Category" />
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-7">
            {categories.map(cat => (
              <AnimatedItem key={cat.id}>
                <Link
                  href={`/category/${cat.slug}`}
                  className="group flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden ring-2 ring-transparent group-hover:ring-indigo-200 transition-all duration-300">
                    {cat.image_url ? (
                      <Image src={cat.image_url} alt={cat.name} width={64} height={64}
                        className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🏷️</div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-center text-gray-700 group-hover:text-indigo-600 transition-colors duration-200">
                    {cat.name}
                  </span>
                </Link>
              </AnimatedItem>
            ))}
          </AnimatedGrid>
        </section>
      )}

      {/* ── Featured Products ── */}
      {featured && featured.length > 0 && (
        <section className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 pb-14">
          <SectionHeader title="Featured Products" href="/products" linkLabel="View all →" />
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-7">
            {featured.map((p, i) => (
              <AnimatedItem key={p.id}>
                <ProductCard product={p} priority={i < 4} />
              </AnimatedItem>
            ))}
          </AnimatedGrid>
        </section>
      )}

      {/* ── Deals Banner — consistent min-height ── */}
      {deals && deals.length > 0 && (
        <section className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 pb-14">
          <div
            className={`relative overflow-hidden rounded-2xl min-h-50 flex flex-col sm:flex-row items-center justify-between gap-6 px-8 sm:px-12 py-10 ${
              dealBanner ? '' : 'bg-linear-to-r from-rose-500 to-orange-400'
            }`}
            style={dealBanner ? { backgroundColor: dealBanner.bg_color ?? '#111827' } : undefined}
          >
            {dealBanner?.image_url && (
              <Image src={dealBanner.image_url} alt="" fill
                sizes="(max-width: 1400px) 100vw, 1400px"
                className="object-cover opacity-20 pointer-events-none" />
            )}
            <div className="absolute inset-0 bg-linear-to-r from-black/30 via-transparent to-black/10 pointer-events-none" />

            <div className="relative z-10" style={{ color: dealBanner?.text_color ?? '#ffffff' }}>
              {!dealBanner && (
                <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Limited Time</p>
              )}
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                {dealBanner?.title ?? 'Up to 50% OFF'}
              </h2>
              <p className="opacity-80 mt-2 text-base md:text-lg">
                {dealBanner?.subtitle ?? 'Selected items — while stocks last'}
              </p>
            </div>
            <Link
              href={dealBanner?.link_url ?? '/products?sale=true'}
              className="relative z-10 shrink-0 bg-white text-gray-900 px-8 py-3.5 rounded-full font-bold text-sm hover:bg-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
            >
              {dealBanner?.link_text ?? 'See Deals'}
            </Link>
          </div>
        </section>
      )}

      {/* ── Deals Grid ── */}
      {deals && deals.length > 0 && (
        <section className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 pb-20">
          <SectionHeader title="Deals & Offers" href="/products?sale=true" linkLabel="View all →" />
          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-7">
            {deals.map(p => (
              <AnimatedItem key={p.id}>
                <ProductCard product={p} />
              </AnimatedItem>
            ))}
          </AnimatedGrid>
        </section>
      )}
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
      {href && linkLabel && (
        <Link href={href}
          className="text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors duration-200">
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, priority = false }: {
  product: { id: string; name: string; slug: string; price: number; compare_price: number | null; images: string[] | null }
  priority?: boolean
}) {
  const image    = product.images?.[0]
  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0

  return (
    <Link href={`/products/${product.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 h-full">
      <div className="aspect-3/4 bg-gray-50 relative overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">📦</div>
        )}
        {discount > 0 && (
          <span className="absolute top-2.5 left-2.5 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="text-sm font-medium line-clamp-2 mb-2 text-gray-800 group-hover:text-gray-900 transition-colors leading-snug">
          {product.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-gray-900">{formatPrice(product.price)}</span>
          {product.compare_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.compare_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
