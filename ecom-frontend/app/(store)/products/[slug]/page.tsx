import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { Star, Shield, RefreshCw, Truck } from 'lucide-react'
import ProductGallery from './ProductGallery'
import VariantSelector from './VariantSelector'
import AddToCartButton from './AddToCartButton'
import ReviewsList from './ReviewsList'
import ReviewForm from './ReviewForm'
import RecommendedProducts from './RecommendedProducts'
import ProductOffers from './ProductOffers'

export const revalidate = 60
export const dynamicParams = true

// Pre-render the first 50 products at build time for instant load
export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []).map(p => ({ slug: p.slug }))
}

interface Props { params: Promise<{ slug: string }> }

// ISR cache for product core data — busted when products tag is invalidated
const getProductBySlug = unstable_cache(
  async (slug: string) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('slug', slug)
      .maybeSingle()
    if (error) console.error('[product page] product query:', error.message)
    return data
  },
  ['product-by-slug'],
  { revalidate: 60, tags: ['products'] }
)

// React cache() deduplicates within one request (generateMetadata + page)
const getProduct = cache(getProductBySlug)

// Cache offers — busted when offers tag is invalidated
const getOffers = unstable_cache(
  async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return []
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('offers')
      .select('id, title, description, type, upfront_pct, discount_pct, sort_order')
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  },
  ['offers-list'],
  { revalidate: 300, tags: ['offers'] }
)

// Cache reviews, variants, recommended — busted independently
const getProductSupportData = unstable_cache(
  async (productId: string, categoryId: string | null) => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { reviews: [], variants: [], recommended: [] }
    const supabase = createPublicClient()

    const [{ data: reviewRows }, { data: variantRows }, { data: recommendedRaw }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, rating, comment, created_at, is_verified_purchase, profiles(full_name)')
        .eq('product_id', productId)
        .eq('is_approved', true),
      supabase
        .from('product_variants')
        .select('id, name, options')
        .eq('product_id', productId),
      supabase
        .from('products')
        .select('id, name, slug, price, compare_price, images')
        .eq('is_active', true)
        .eq('category_id', categoryId ?? '')
        .neq('id', productId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Fill with latest products if not enough from same category
    const recommended = recommendedRaw && recommendedRaw.length >= 4
      ? recommendedRaw
      : await supabase
          .from('products')
          .select('id, name, slug, price, compare_price, images')
          .eq('is_active', true)
          .neq('id', productId)
          .order('created_at', { ascending: false })
          .limit(10)
          .then(r => r.data ?? [])

    return {
      reviews: reviewRows ?? [],
      variants: (variantRows ?? []).map((v: any) => ({
        id: v.id,
        name: v.name,
        options: Array.isArray(v.options) ? v.options : [],
      })),
      recommended: recommended ?? [],
    }
  },
  ['product-support-data'],
  { revalidate: 60, tags: ['reviews', 'products'] }
)

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Product Not Found' }
  return { title: product.name, description: product.description?.slice(0, 160) }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product || product.is_active === false) notFound()

  const [{ reviews, variants, recommended }, offers] = await Promise.all([
    getProductSupportData(product.id, product.category_id ?? null),
    getOffers(),
  ])

  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0

  const avgRating = reviews.length
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
    : 0

  const images: string[] = product.images ?? []
  const videoUrl: string | null = product.video_url ?? null

  const savings = product.compare_price
    ? product.compare_price - product.price
    : 0

  return (
    <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: images[0],
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: 'INR',
              availability:
                product.stock > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
          }),
        }}
      />

      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-gray-700 transition">Home</Link>
        <span>/</span>
        {product.categories && (
          <>
            <Link href={`/category/${product.categories.slug}`} className="hover:text-gray-700 transition">
              {product.categories.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-600 truncate max-w-45">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-[1fr_1fr] lg:grid-cols-[45%_1fr] gap-8 lg:gap-14">
        {/* ── LEFT: Gallery ── */}
        <div className="md:sticky md:top-24 md:self-start">
          <ProductGallery images={images} name={product.name} videoUrl={videoUrl} />
        </div>

        {/* ── RIGHT: Product Info ── */}
        <div className="flex flex-col gap-5">

          {/* Category label */}
          {product.categories && (
            <Link
              href={`/category/${product.categories.slug}`}
              className="text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-700 transition"
            >
              {product.categories.name}
            </Link>
          )}

          {/* Name */}
          <h1 className="text-2xl lg:text-3xl font-bold leading-snug text-gray-900">
            {product.name}
          </h1>

          {/* Rating row */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                <span>{avgRating.toFixed(1)}</span>
                <Star size={10} className="fill-white" />
              </div>
              <span className="text-sm text-gray-500">
                {reviews.length} {reviews.length === 1 ? 'rating' : 'ratings'}
              </span>
            </div>
          )}

          {/* Price block */}
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-extrabold text-gray-900">
                {formatPrice(product.price)}
              </span>
              {product.compare_price && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(product.compare_price)}
                  </span>
                  <span className="text-base font-bold text-green-600">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>
            {savings > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">
                You save {formatPrice(savings)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">inclusive of all taxes</p>
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                product.stock === 0
                  ? 'bg-red-50 text-red-600'
                  : product.stock < 10
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {product.stock === 0
                ? 'Out of Stock'
                : product.stock < 10
                ? `Only ${product.stock} left!`
                : 'In Stock'}
            </span>
            {product.sku && (
              <span className="text-xs text-gray-400">SKU: {product.sku}</span>
            )}
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="border-t border-gray-100 pt-5">
              <VariantSelector variants={variants} />
            </div>
          )}

          {/* Offers */}
          <div className="border-t border-gray-100 pt-5">
            <ProductOffers price={product.price} initialOffers={offers} />
          </div>

          {/* Add to Cart */}
          <div className="border-t border-gray-100 pt-5">
            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                image: images[0] ?? null,
                stock: product.stock,
              }}
            />
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-5">
            <div className="flex flex-col items-center gap-1 text-center p-3 bg-gray-50 rounded-xl">
              <Truck size={18} className="text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 leading-tight">Free Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center p-3 bg-gray-50 rounded-xl">
              <RefreshCw size={18} className="text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 leading-tight">Easy Returns</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center p-3 bg-gray-50 rounded-xl">
              <Shield size={18} className="text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 leading-tight">Secure Pay</span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Product Details</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-16 border-t border-gray-100 pt-10">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">Customer Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    size={15}
                    className={
                      s <= Math.round(avgRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-200'
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                {avgRating.toFixed(1)} ({reviews.length})
              </span>
            </div>
          )}
        </div>

        {reviews.length > 0 ? (
          <ReviewsList reviews={reviews} />
        ) : (
          <p className="text-sm text-gray-400 mb-8">No reviews yet. Be the first!</p>
        )}

        {product.id && <ReviewForm productId={product.id} />}
      </div>

      {/* Recommended Products */}
      <RecommendedProducts products={recommended as any[]} />
    </div>
  )
}
