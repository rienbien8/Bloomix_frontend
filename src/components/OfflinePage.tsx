"use client";

import { FiWifi, FiRefreshCw, FiMapPin, FiHeart } from "react-icons/fi";

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* オフラインアイコン */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <FiWifi className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            オフラインです
          </h1>
          <p className="text-gray-600">インターネット接続を確認してください</p>
        </div>

        {/* 機能説明 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            オフラインでも利用可能
          </h2>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiMapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-800">
                  保存されたスポット
                </h3>
                <p className="text-sm text-gray-600">
                  以前に表示したスポット情報
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FiHeart className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-800">お気に入り</h3>
                <p className="text-sm text-gray-600">
                  保存したお気に入りスポット
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-3 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2"
          >
            <FiRefreshCw className="w-5 h-5" />
            <span>再接続を試す</span>
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200"
          >
            前のページに戻る
          </button>
        </div>

        {/* ヒント */}
        <div className="mt-8 text-sm text-gray-500">
          <p>💡 ヒント: モバイルデータを有効にするか、</p>
          <p>Wi-Fi接続を確認してください</p>
        </div>
      </div>
    </div>
  );
}
