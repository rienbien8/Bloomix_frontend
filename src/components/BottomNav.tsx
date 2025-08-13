import { HomeIcon, Compass, Plus, Bell, Gear } from './Icons'

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-gray-100">
      <div className="max-w-md mx-auto grid grid-cols-5 py-2 px-6 text-gray-500">
        <button className="flex flex-col items-center gap-1 text-brand-dark">
          <HomeIcon className="w-6 h-6" />
          <span className="text-[10px]">ホーム</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Compass className="w-6 h-6" />
          <span className="text-[10px]">スポット</span>
        </button>
        <button className="flex items-center justify-center">
          <span className="sr-only">追加</span>
          <div className="w-12 h-12 -mt-6 rounded-full bg-brand text-white flex items-center justify-center shadow-card">
            <Plus className="w-6 h-6" />
          </div>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Bell className="w-6 h-6" />
          <span className="text-[10px]">お知らせ</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Gear className="w-6 h-6" />
          <span className="text-[10px]">設定</span>
        </button>
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
  )
}