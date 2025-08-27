"use client";

import { usePWA } from "../hooks/usePWA";
import { FiWifi, FiWifiOff } from "react-icons/fi";

export default function OfflineDetector() {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-[9997] max-w-sm w-full mx-4">
      <div className="bg-orange-500 text-white rounded-xl px-4 py-3 shadow-lg flex items-center space-x-3">
        <FiWifiOff className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">オフラインです</p>
          <p className="text-xs opacity-90">一部の機能が制限されます</p>
        </div>
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      </div>
    </div>
  );
} 