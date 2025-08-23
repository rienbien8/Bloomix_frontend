import type { Content } from '../modules/types'

type Props = { content: Content }

export default function ContentCard({ content }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-card p-3 flex items-center gap-3">
      <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
        {content.thumbnail_url ? (<img src={content.thumbnail_url} alt={content.title} className="w-full h-full object-cover" />)
          : (<div className="text-gray-400 text-xs">No Image</div>)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium line-clamp-2">{content.title}</div>
        <div className="text-xs text-gray-500">♫ {content.duration_min ? `${content.duration_min}分` : ''}</div>
      </div>
      <button
        className="ml-auto rounded-full bg-gray-100 px-3 py-2 text-xs text-gray-700"
        aria-label="再生"
      >
        ▶︎
      </button>
    </div>
  )
}