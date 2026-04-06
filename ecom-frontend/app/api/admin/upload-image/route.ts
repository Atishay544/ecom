import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'product-images'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// Cache bucket existence — listBuckets() is skipped after first successful check
let bucketReady = false

async function ensureBucket(adminSupabase: ReturnType<typeof createAdminClient>) {
  if (bucketReady) return
  const { data: buckets } = await adminSupabase.storage.listBuckets()
  if (!buckets?.some(b => b.id === BUCKET)) {
    const { error } = await adminSupabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    })
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create bucket: ${error.message}`)
    }
  }
  bucketReady = true
}

export async function POST(req: NextRequest) {
  // Verify admin session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const adminSupabase = createAdminClient()

  // Fast-path: role in JWT app_metadata avoids a DB round-trip
  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    const { data: profile } = await adminSupabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Parse multipart form
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP or GIF.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 5 MB per image.' }, { status: 400 })
  }

  // Ensure bucket + read file buffer in parallel
  let buffer: Uint8Array
  try {
    const [arrayBuffer] = await Promise.all([
      file.arrayBuffer(),
      ensureBucket(adminSupabase),
    ])
    buffer = new Uint8Array(arrayBuffer)
  } catch (e: any) {
    console.error('upload-image setup error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
  const storagePath = `products/${fileName}`

  const { error: uploadError } = await adminSupabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = adminSupabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return NextResponse.json({ url: publicUrl })
}
