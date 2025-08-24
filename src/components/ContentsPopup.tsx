import { useEffect } from "react";
import ContentCard from "./ContentCard";
import type { Content } from "../modules/types";

type Props = {
  contents: Content[] | null;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export default function ContentsPopup({
  contents,
  isOpen,
  onClose,
  title,
}: Props) {
  // ESCキーでポップアップを閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      // スクロールを無効化
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>

        {/* コンテンツ一覧 */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {contents && contents.length > 0 ? (
            <div className="space-y-3">
              {contents.map((content) => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              コンテンツがありません
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
