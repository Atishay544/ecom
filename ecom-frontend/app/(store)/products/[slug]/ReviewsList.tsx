import { Star } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ReviewsList({ reviews }: { reviews: any[] }) {
  return (
    <div className="space-y-5">
      {reviews.map(r => (
        <div key={r.id} className="border-b pb-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14}
                  className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
              ))}
            </div>
            <span className="text-sm font-medium">{r.profiles?.full_name ?? 'Customer'}</span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
            </span>
          </div>
          {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
        </div>
      ))}
    </div>
  )
}
