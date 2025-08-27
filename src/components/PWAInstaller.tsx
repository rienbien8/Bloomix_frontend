"use client";

import { useState, useEffect } from "react";
import { FiDownload, FiX } from "react-icons/fi";
import { usePWA } from "../hooks/usePWA";

export default function PWAInstaller() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Service Workerの登録
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker登録成功:", registration);
        })
        .catch((error) => {
          console.log("Service Worker登録失敗:", error);
        });
    }

    // インストール可能な場合はプロンプトを表示
    if (isInstallable) {
      setShowInstallPrompt(true);
    }
  }, [isInstallable]);

  const handleInstallClick = async () => {
    const success = await installApp();
    if (success) {
      setShowInstallPrompt(false);
    }
  };

  const handleClosePrompt = () => {
    setShowInstallPrompt(false);
  };

  // インストール済みまたはインストールプロンプトが表示されない場合は何も表示しない
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[9998] max-w-sm w-full mx-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiDownload className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              ホーム画面に追加
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              アプリをインストールして、より快適に推しスポットを発見しましょう
            </p>

            <div className="flex space-x-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                インストール
              </button>
              <button
                onClick={handleClosePrompt}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 