import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function RewardPopup({ isOpen, onClose }: Props) {
  // ESCキーでポップアップを閉じる
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
      // スクロールを無効化
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* ポップアップコンテンツ */}
      <div className="relative bg-white rounded-2xl p-8 mx-4 max-w-sm w-full shadow-2xl">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="閉じる"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* メインコンテンツ */}
        <div className="text-center">
          {/* アイコン */}
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-b from-brand-sky to-brand-sunrise rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
          </div>

          {/* メッセージ */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            HONDAスポットに到着！
          </h2>

          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            新しいコンテンツを獲得しました
            <br />
            <span className="font-semibold" style={{ color: "#FF9900" }}>
              Myコンテンツ
            </span>
            から確認できます
          </p>

          {/* 確認ボタン */}
          <button
            onClick={onClose}
            className="w-full text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: "#FFC266" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
