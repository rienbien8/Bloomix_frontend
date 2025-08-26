import type { Spot } from "../modules/types";
import { useRouter } from "next/navigation";

type Props = { spot: Spot };

export default function SpotCard({ spot }: Props) {
  const router = useRouter();

  // サムネイル画像を取得（is_specialの値に応じて）
  const getThumbnailImage = () => {
    if (spot.is_special) {
      return "/HondaLogo.svg";
    } else {
      return "/star_logo.svg";
    }
  };

  const thumbnailImage = getThumbnailImage();

  // 目的地に設定ボタンのクリックハンドラー
  const handleSetDestination = () => {
    // drive/pageに遷移し、スポットの座標をクエリパラメータとして渡す
    const params = new URLSearchParams({
      lat: spot.lat.toString(),
      lng: spot.lng.toString(),
      name: spot.name,
      address: spot.address || "",
    });

    const destinationUrl = `/drive?${params.toString()}`;
    console.log("🚗 drive/pageに遷移中:", destinationUrl);
    console.log("📍 スポット情報:", {
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      address: spot.address,
    });

    router.push(destinationUrl);
  };

  return (
    <div className="bg-white rounded-xl shadow-card px-3 py-3 flex items-center gap-3">
      <div
        className={`flex items-center justify-center shrink-0 overflow-hidden ${
          spot.is_special ? "w-12 h-10 rounded-lg" : "w-10 h-10 rounded-full"
        }`}
      >
        <img
          src={thumbnailImage}
          alt={spot.is_special ? "Honda Logo" : "Star Logo"}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium truncate">
          {spot.name}
        </div>
        <div className="text-xs text-gray-500 truncate whitespace-nowrap">
          {spot.oshis && spot.oshis.length > 0
            ? `${spot.oshis.map((o) => o.name).join("、")}`
            : spot.description || spot.address}
        </div>
      </div>
      <button
        className="text-xs text-white rounded-full px-3 py-1 shrink-0"
        style={{
          backgroundColor: spot.is_special ? "#EC4899" : "#38BDF8",
        }}
        onClick={handleSetDestination}
      >
        目的地に設定
      </button>
    </div>
  );
}
