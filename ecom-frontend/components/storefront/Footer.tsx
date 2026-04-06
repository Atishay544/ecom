import Link from 'next/link'

const links = {
  Shop:    [
    { label: 'All Products', href: '/products' },
    { label: 'Men', href: '/category/men' },
    { label: 'Women', href: '/category/women' },
    { label: 'Electronics', href: '/category/electronics' },
  ],
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

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6 mt-16">
      <div className="max-w-350 mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <h2 className="text-white font-bold text-xl mb-3">STORE</h2>
          <p className="text-sm leading-relaxed">Quality products delivered to your door. Free shipping on orders above $499.</p>
          <div className="flex gap-3 mt-4">
            {socials.map(s => (
              <a key={s.label} href={s.href}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-white hover:text-black transition flex items-center justify-center text-xs font-bold">
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {Object.entries(links).map(([title, items]) => (
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
        <p>© {new Date().getFullYear()} Store. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="mailto:orders@aitalk247.com" className="hover:text-white">orders@aitalk247.com</a>
          <a href="mailto:support@aitalk247.com" className="hover:text-white">support@aitalk247.com</a>
        </div>
      </div>
    </footer>
  )
}
