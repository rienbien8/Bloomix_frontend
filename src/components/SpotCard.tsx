import type { Spot } from "../modules/types";

type Props = { spot: Spot };

export default function SpotCard({ spot }: Props) {
  // 推しの画像URLを取得（最初の推しの画像を使用）
  const oshiImageUrl =
    spot.oshis && spot.oshis.length > 0 ? spot.oshis[0].image_url : null;

  return (
    <div className="bg-white rounded-xl shadow-card px-3 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
        {oshiImageUrl ? (
          <img
            src={oshiImageUrl}
            alt={`${spot.oshis![0].name}の画像`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // 画像読み込みエラー時は頭文字を表示
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        {/* フォールバック用の頭文字表示 */}
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold ${
            oshiImageUrl ? "hidden" : "block"
          }`}
          style={{
            background: oshiImageUrl ? "transparent" : "#fbbf24", // yellow-300
          }}
        >
          {spot.name.charAt(0)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium truncate">
          {spot.name}
        </div>
        <div className="text-xs text-gray-500 truncate whitespace-nowrap">
          {spot.oshis && spot.oshis.length > 0
            ? `ゆかりの推し：${spot.oshis.map((o) => o.name).join("、")}`
            : spot.description || spot.address}
        </div>
      </div>
      <button className="text-xs bg-brand text-white rounded-full px-3 py-1 shrink-0">
        目的地に設定
      </button>
    </div>
  );
}
