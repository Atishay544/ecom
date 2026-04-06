'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => set(state => {
        const existing = state.items.find(i => i.id === item.id)
        if (existing) {
          return {
            items: state.items.map(i =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          }
        }
        return { items: [...state.items, item] }
      }),

      removeItem: (id) => set(state => ({
        items: state.items.filter(i => i.id !== id),
      })),

      updateQuantity: (id, quantity) => set(state => {
        if (quantity <= 0) return { items: state.items.filter(i => i.id !== id) }
        return { items: state.items.map(i => i.id === id ? { ...i, quantity } : i) }
      }),

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'ecom-cart' }
  )
)
