import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import CategoryActions from './CategoryActions'
import CategoryForm from './CategoryForm'

export const metadata = { title: 'Categories' }

export default async function CategoriesPage() {
  const supabase = createAdminClient()

  await requireAdmin()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id, sort_order, categories!parent_id(name)')
    .order('sort_order', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Categories</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">All Categories</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Slug</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Parent</th>
                <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map(cat => (
                <tr key={cat.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{cat.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{cat.slug}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {(cat.categories as any)?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <CategoryActions
                      categoryId={cat.id}
                      categoryName={cat.name}
                      categorySlug={cat.slug}
                      parentId={cat.parent_id ?? null}
                      sortOrder={cat.sort_order ?? 0}
                      categories={categories?.map(c => ({ id: c.id, name: c.name })) ?? []}
                    />
                  </td>
                </tr>
              ))}
              {(!categories || categories.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">No categories yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Create form */}
        <div>
          <CategoryForm categories={categories?.map(c => ({ id: c.id, name: c.name })) ?? []} />
        </div>
      </div>
    </div>
  )
}
