import Link from 'next/link'
import Image from 'next/image'

type Category = { id: string; name: string; slug: string }

const staticLinks = {
  Account: [
    { label: 'My Orders', href: '/account/orders' },
    { label: 'Wishlist', href: '/wishlist' },
    { label: 'My Profile', href: '/account' },
  ],
  Support: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'FAQs', href: '/faq' },
    { label: 'Refund & Returns', href: '/refund-policy' },
    { label: 'Shipping Info', href: '/shipping-policy' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
}

const socials = [
  { label: 'Instagram', href: '#', icon: 'IG' },
  { label: 'Twitter',   href: '#', icon: 'TW' },
  { label: 'Facebook',  href: '#', icon: 'FB' },
]

export default function Footer({ categories = [] }: { categories?: Category[] }) {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6 mt-16">
      <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="inline-flex items-center mb-3">
            <Image
              src="/lF logo.png"
              alt="Layers Factory"
              width={48}
              height={48}
              className="h-12 w-auto object-contain"
            />
          </Link>
          <p className="text-sm leading-relaxed">India's trusted store for premium marble temples & divine sculptures. Free shipping above ₹499.</p>
          <div className="flex gap-3 mt-4">
            {socials.map(s => (
              <a key={s.label} href={s.href}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-white hover:text-black transition flex items-center justify-center text-xs font-bold">
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Shop — dynamic categories from DB */}
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm">Shop</h3>
          <ul className="space-y-2">
            <li>
              <Link href="/products" className="text-sm hover:text-white transition">All Products</Link>
            </li>
            {categories.map(cat => (
              <li key={cat.id}>
                <Link href={`/category/${cat.slug}`} className="text-sm hover:text-white transition">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Static link sections */}
        {Object.entries(staticLinks).map(([title, items]) => (
          <div key={title}>
            <h3 className="text-white font-semibold mb-3 text-sm">{title}</h3>
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm hover:text-white transition">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-6 max-w-350 mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Layers Factory. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="mailto:atishayjain54@gmail.com" className="hover:text-white">atishayjain54@gmail.com</a>
        </div>
      </div>
    </footer>
  )
}
