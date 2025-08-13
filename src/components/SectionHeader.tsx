type Props = { title: string; onMore?: () => void }

export default function SectionHeader({ title, onMore }: Props) {
  return (
    <div className="max-w-md mx-auto px-4 mt-5 mb-2 flex items-center justify-between">
      <div className="text-gray-800 font-semibold flex items-center gap-2">
        <span className="text-pink-500">☆</span>
        <span>{title}</span>
      </div>
      <button
        className="text-sm text-brand-dark hover:underline"
        onClick={onMore}
      >
        一覧へ
      </button>
    </div>
  )
}