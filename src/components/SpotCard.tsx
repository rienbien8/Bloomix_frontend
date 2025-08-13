import type { Spot } from '../modules/types'

type Props = { spot: Spot }

export default function SpotCard({ spot }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-card px-3 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center shrink-0 text-white font-bold">
        {spot.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium truncate">{spot.name}</div>
        <div className="text-xs text-gray-500 truncate">{spot.description || spot.address}</div>
      </div>
      <button className="text-xs bg-brand text-white rounded-full px-3 py-1 shrink-0">
        経路に追加
      </button>
    </div>
  )
}