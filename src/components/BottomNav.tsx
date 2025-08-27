"use client";

import { usePathname, useRouter } from "next/navigation";
import { HomeIcon, Compass, Heart, Gear } from "./Icons";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    // タップ時の触覚フィードバック（モバイルデバイス対応）
    if (
      typeof window !== "undefined" &&
      "navigator" in window &&
      "vibrate" in navigator
    ) {
      navigator.vibrate(10); // 10msの短い振動
    }

    router.push(path);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-t border-gray-100 shadow-lg">
      <div className="max-w-md mx-auto flex justify-center gap-x-16 py-3 px-6 text-gray-500">
        <button
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 ease-out transform active:scale-95 relative ${
            isActive("/")
              ? "text-brand-dark scale-105"
              : "hover:text-gray-700 hover:scale-105 active:text-brand-dark"
          }`}
          onClick={() => handleNavigation("/")}
        >
          <div
            className={`p-2 rounded-full transition-all duration-200 ${
              isActive("/")
                ? "bg-brand-light/20 scale-110"
                : "hover:bg-gray-100 active:bg-brand-light/10"
            }`}
          >
            <HomeIcon className="w-6 h-6" />
          </div>
          <span
            className={`text-[10px] font-medium transition-colors duration-200 ${
              isActive("/") ? "text-brand-dark" : ""
            }`}
          >
            ホーム
          </span>
          {isActive("/") && (
            <div className="absolute -top-1 w-2 h-2 bg-brand-dark rounded-full animate-pulse" />
          )}
        </button>

        <button
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 ease-out transform active:scale-95 relative ${
            isActive("/drive")
              ? "text-brand-dark scale-105"
              : "hover:text-gray-700 hover:scale-105 active:text-brand-dark"
          }`}
          onClick={() => handleNavigation("/drive")}
        >
          <div
            className={`p-2 rounded-full transition-all duration-200 ${
              isActive("/drive")
                ? "bg-brand-light/20 scale-110"
                : "hover:bg-gray-100 active:bg-brand-light/10"
            }`}
          >
            <Compass className="w-6 h-6" />
          </div>
          <span
            className={`text-[10px] font-medium transition-colors duration-200 ${
              isActive("/drive") ? "text-brand-dark" : ""
            }`}
          >
            ドライブ
          </span>
          {isActive("/drive") && (
            <div className="absolute -top-1 w-2 h-2 bg-brand-dark rounded-full animate-pulse" />
          )}
        </button>

        <button
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 ease-out transform active:scale-95 relative ${
            isActive("/follow")
              ? "text-brand-dark scale-105"
              : "hover:text-gray-700 hover:scale-105 active:text-brand-dark"
          }`}
          onClick={() => handleNavigation("/followartists")}
        >
          <div
            className={`p-2 rounded-full transition-all duration-200 ${
              isActive("/follow")
                ? "bg-brand-light/20 scale-110"
                : "hover:bg-gray-100 active:bg-brand-light/10"
            }`}
          >
            <Heart className="w-6 h-6" />
          </div>
          <span
            className={`text-[10px] font-medium transition-colors duration-200 ${
              isActive("/follow") ? "text-brand-dark" : ""
            }`}
          >
            フォロー
          </span>
          {isActive("/follow") && (
            <div className="absolute -top-1 w-2 h-2 bg-brand-dark rounded-full animate-pulse" />
          )}
        </button>

        <button
          className={`flex flex-col items-center gap-1.5 transition-all duration-200 ease-out transform relative ${
            isActive("/settings")
              ? "text-gray-400 scale-105"
              : "text-gray-300 hover:text-gray-400 hover:scale-105"
          } cursor-not-allowed opacity-60`}
          disabled
          title="設定ページは準備中です"
        >
          <div
            className={`p-2 rounded-full transition-all duration-200 ${
              isActive("/settings")
                ? "bg-gray-100 scale-110"
                : "hover:bg-gray-50"
            }`}
          >
            <Gear className="w-6 h-6" />
          </div>
          <span
            className={`text-[10px] font-medium transition-colors duration-200 ${
              isActive("/settings") ? "text-gray-400" : ""
            }`}
          >
            設定
          </span>
          {isActive("/settings") && (
            <div className="absolute -top-1 w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          )}
        </button>
      </div>
    </nav>
  );
}
