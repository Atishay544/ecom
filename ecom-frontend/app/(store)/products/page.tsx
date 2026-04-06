import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { formatPrice } from '@/lib/utils'
import ProductFilters from './ProductFilters'
import SortSelect from './SortSelect'
import ProductSkeletonGrid from '@/components/ui/ProductSkeleton'

export const revalidate = 30

export const metadata = {
  title: 'All Products',
  description: 'Browse our full collection of products. Filter by category, price and more.',
}

interface Props {
  searchParams: Promise<{
    category?: string
    sort?: string
    min?: string
    max?: string
    sale?: string
    page?: string
  }>
}

const PAGE_SIZE = 20

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createServerClient()

  let query = supabase
    .from('products')
    .select('id,name,slug,price,compare_price,images,categories(name,slug)', { count: 'exact' })
    .eq('is_active', true)
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.category) query = query.eq('category_id', params.category)
  if (params.sale === 'true') query = query.not('compare_price', 'is', null)
  if (params.min) query = query.gte('price', parseFloat(params.min))
  if (params.max) query = query.lte('price', parseFloat(params.max))

  const sort = params.sort ?? 'newest'
  if (sort === 'newest')       query = query.order('created_at', { ascending: false })
  else if (sort === 'price_asc')  query = query.order('price', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false })
  else if (sort === 'popular')    query = query.order('stock', { ascending: false })

  const { data: products, count } = await query
  const { data: categories } = await supabase
    .from('categories').select('id,name,slug').is('parent_id', null).order('sort_order')

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <h1 className="text-2xl font-bold mb-6">All Products</h1>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="hidden lg:block w-56 shrink-0">
          <ProductFilters categories={categories ?? []} currentParams={params} />
        </aside>

        <div className="flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-sm text-gray-500">{count ?? 0} products</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort:</span>
              <SortSelect current={sort} />
            </div>
          </div>

          {/* Grid */}
          <Suspense fallback={<ProductSkeletonGrid />}>
            {products && products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="text-center py-24 text-gray-400">
                <p className="text-xl mb-2">No products found</p>
                <Link href="/products" className="text-sm underline">Clear filters</Link>
              </div>
            )}
          </Suspense>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <PaginationLink key={p} page={p} current={page} params={params} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: any }) {
  const image = product.images?.[0]
  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100) : 0

  return (
    <Link href={`/products/${product.slug}`} className="group">
      <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-3 relative">
        {image
          ? <Image src={image} alt={product.name} fill className="object-cover group-hover:scale-105 transition" />
          : <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">📦</div>
        }
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </span>
        )}
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-1">{product.name}</p>
      <div className="flex items-center gap-2">
        <span className="font-bold">{formatPrice(product.price, 'USD')}</span>
        {product.compare_price && (
          <span className="text-sm text-gray-400 line-through">{formatPrice(product.compare_price, 'USD')}</span>
        )}
      </div>
    </Link>
  )
}


function PaginationLink({ page, current, params }: { page: number; current: number; params: Record<string, string | undefined> }) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v && sp.set(k, v))
  sp.set('page', String(page))
  return (
    <Link href={`/products?${sp.toString()}`}
      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition
        ${page === current ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
      {page}
    </Link>
  )
}
