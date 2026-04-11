import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'

export const revalidate = 3600
export const dynamicParams = true

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

const PAGE_SIZE = 20

// React cache() deduplicates between generateMetadata + page within same request
const getCategoryBySlug = cache(async (slug: string) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('id,name,image_url')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

// Pre-render top 12 categories at build time
export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return []
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('slug')
    .is('parent_id', null)
    .order('sort_order')
    .limit(12)
  return (data ?? []).map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  return { title: category?.name ?? 'Category' }
}

const getCategoryProducts = unstable_cache(
  async (categoryId: string, sort: string, page: number) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { products: [], count: 0 }
    const supabase = createPublicClient()
    const offset = (page - 1) * PAGE_SIZE

    let query = supabase
      .from('products')
      .select('id,name,slug,price,compare_price,images', { count: 'exact' })
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .range(offset, offset + PAGE_SIZE - 1)

    if (sort === 'price_asc')       query = query.order('price', { ascending: true })
    else if (sort === 'price_desc') query = query.order('price', { ascending: false })
    else if (sort === 'popular')    query = query.order('stock', { ascending: false })
    else                            query = query.order('created_at', { ascending: false })

    const { data: products, count } = await query
    return { products: products ?? [], count: count ?? 0 }
  },
  ['category-products'],
  { revalidate: 3600, tags: ['categories', 'products'] }
)

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { sort = 'newest', page: pageStr = '1' } = await searchParams
  const page = Math.max(1, parseInt(pageStr))

  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const { products, count } = await getCategoryProducts(category.id, sort, page)
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 py-10">
      {/* Category header */}
      {category.image_url && (
        <div className="relative h-40 rounded-2xl overflow-hidden mb-6 bg-gray-100">
          <Image src={category.image_url} alt={category.name} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center px-8">
            <h1 className="text-3xl font-bold text-white">{category.name}</h1>
          </div>
        </div>
      )}
      {!category.image_url && <h1 className="text-2xl font-bold mb-6">{category.name}</h1>}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm text-gray-500">{count} products</p>
        <div className="flex gap-2">
          {[['newest','Newest'],['popular','Popular'],['price_asc','Price ↑'],['price_desc','Price ↓']].map(([v, l]) => (
            <Link key={v}
              href={`/category/${slug}?sort=${v}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${sort === v ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-gray-500'}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((p: any) => {
            const discount = p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : 0
            return (
              <Link key={p.id} href={`/products/${p.slug}`} className="group">
                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-2 relative">
                  {p.images?.[0]
                    ? <Image
                        src={p.images[0]} alt={p.name} fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover group-hover:scale-105 transition"
                        placeholder="blur"
                        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">📦</div>}
                  {discount > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      -{discount}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-sm">{formatPrice(p.price)}</span>
                  {p.compare_price && <span className="text-xs text-gray-400 line-through">{formatPrice(p.compare_price)}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">No products in this category yet.</div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`/category/${slug}?sort=${sort}&page=${p}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition
                ${p === page ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
