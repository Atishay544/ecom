'use client'
import { useState } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'

interface Product { id: string; name: string; price: number; image: string | null; stock: number }

export default function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore(s => s.addItem)
  const [added, setAdded] = useState(false)
  const [qty, setQty] = useState(1)

  function handleAdd() {
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image ?? '', quantity: qty })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (product.stock === 0) {
    return (
      <button disabled className="w-full py-3 rounded-xl bg-gray-200 text-gray-400 font-semibold cursor-not-allowed">
        Out of Stock
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Qty:</span>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-1.5 hover:bg-gray-100 transition text-lg">−</button>
          <span className="px-4 py-1.5 text-sm font-medium">{qty}</span>
          <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} className="px-3 py-1.5 hover:bg-gray-100 transition text-lg">+</button>
        </div>
      </div>
      <button
        onClick={handleAdd}
        className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
          ${added ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-gray-800'}`}>
        {added ? <><Check size={18} /> Added!</> : <><ShoppingCart size={18} /> Add to Cart</>}
      </button>
    </div>
  )
}
