import { MapPin } from './Icons'

export default function HeroMapCard() {
  return (
    <div className="max-w-md mx-auto px-4 -mt-6">
      <div className="bg-gradient-to-br from-white to-brand-light rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">Google Maps連携</div>
          <span className="text-xs text-gray-500">推しスポット表示エリア</span>
        </div>
        <div className="h-44 rounded-xl bg-white/70 border border-gray-100 flex items-center justify-center mb-3">
          <MapPin className="w-8 h-8 text-brand-dark" />
          <div className="ml-2 text-gray-600 text-sm">現在地</div>
        </div>
        <div className="text-xs text-gray-500">※ マップは後で実装。まずはUIを作り込む段階です。</div>
      </div>
    </div>
  )
}