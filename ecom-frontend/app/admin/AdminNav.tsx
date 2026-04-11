'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  Ticket,
  Megaphone,
  Star,
  MessageSquare,
  Image as ImageIcon,
  BadgePercent,
} from 'lucide-react'

const navLinks = [
  { href: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/products',       label: 'Products',        icon: Package },
  { href: '/admin/orders',         label: 'Orders',          icon: ShoppingCart },
  { href: '/admin/customers',      label: 'Customers',       icon: Users },
  { href: '/admin/categories',     label: 'Categories',      icon: Tag },
  { href: '/admin/banners',        label: 'Banners',         icon: ImageIcon },
  { href: '/admin/offers',         label: 'Offers',          icon: BadgePercent },
  { href: '/admin/coupons',        label: 'Coupons',         icon: Ticket },
  { href: '/admin/announcements',  label: 'Announcements',   icon: Megaphone },
  { href: '/admin/reviews',        label: 'Reviews',         icon: Star },
  { href: '/admin/chat',           label: 'Chat Support',    icon: MessageSquare },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 py-4 overflow-y-auto">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
              isActive
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon size={16} className="shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
