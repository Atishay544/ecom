'use client'
import { useState } from 'react'

interface Variant {
  id: string
  name: string
  options: string[]
}

interface Props {
  variants: Variant[]
}

export default function VariantSelector({ variants }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({})

  if (!variants || variants.length === 0) return null

  return (
    <div className="space-y-5">
      {variants.map(v => (
        <div key={v.id}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-sm font-semibold text-gray-900">{v.name}</span>
            {selected[v.name] && (
              <span className="text-sm text-gray-500">
                : <span className="font-medium text-gray-700">{selected[v.name]}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(v.options) ? v.options : []).map(opt => {
              const isActive = selected[v.name] === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setSelected(prev =>
                      prev[v.name] === opt
                        ? { ...prev, [v.name]: '' }
                        : { ...prev, [v.name]: opt }
                    )
                  }
                  className={`min-w-[44px] px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-150 ${
                    isActive
                      ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-500'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
