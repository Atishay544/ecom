import Link from 'next/link'

export default function AnnouncementBar({ data }: { data: any }) {
  return (
    <div
      style={{ backgroundColor: data.bg_color, color: data.text_color }}
      className="text-sm py-2 px-4 text-center"
    >
      {data.link_url ? (
        <Link href={data.link_url} className="hover:underline">
          {data.message}
          {data.link_text && <span className="font-semibold ml-1">{data.link_text}</span>}
        </Link>
      ) : (
        <span>{data.message}</span>
      )}
    </div>
  )
}
