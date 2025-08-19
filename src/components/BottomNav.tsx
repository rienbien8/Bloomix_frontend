import { HomeIcon, Compass, Bell, Gear } from './Icons'

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-gray-100">
      <div className="max-w-md mx-auto flex justify-center gap-x-16 py-2 px-6 text-gray-500">
        <button className="flex flex-col items-center gap-1 text-brand-dark">
          <HomeIcon className="w-6 h-6" />
          <span className="text-[10px]">ホーム</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Compass className="w-6 h-6" />
          <span className="text-[10px]">ドライブ</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Bell className="w-6 h-6" />
          <span className="text-[10px]">フォロー</span>
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
