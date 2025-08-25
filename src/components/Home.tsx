"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";
import HeroMapCard from "./HeroMapCard";
import SectionHeader from "./SectionHeader";
import SpotCard from "./SpotCard";
import ContentCard from "./ContentCard";
import BottomNav from "./BottomNav";
import SpotsPopup from "./SpotsPopup";
import ContentsPopup from "./ContentsPopup";
import { Api } from "../modules/api";
import { mockSpots, mockContents } from "../modules/mock";
import type { Spot, Content } from "../modules/types";
import MapEmbed from "./MapEmbed";

export default function Home() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [contents, setContents] = useState<Content[] | null>(null);
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSpotsPopupOpen, setIsSpotsPopupOpen] = useState(false);
  const [isContentsPopupOpen, setIsContentsPopupOpen] = useState(false);
  const [userOshiIds, setUserOshiIds] = useState<number[]>([]);
  const router = useRouter();

  // ユーザーの推し情報を取得
  const fetchUserOshis = async () => {
    try {
      const response = await Api.oshis();
      // APIは{count, items}の形式で返す
      const oshis = response.items || [];
      // 仮の実装: 最初の3つの推しをユーザーの推しとして設定
      // 実際の実装では、ユーザー認証システムから推しIDを取得
      const oshiIds = oshis.slice(0, 3).map((o) => o.id);
      setUserOshiIds(oshiIds);
      console.log("🎯 ユーザーの推しID:", oshiIds);
      return oshiIds;
    } catch (error) {
      console.warn("推し情報取得に失敗:", error);
      return [];
    }
  };

  useEffect(() => {
    // 並列で呼び出し。失敗時はモックで補う
    Promise.allSettled([Api.spots(), Api.contents({ limit: 10 })]).then(
      (res) => {
        const [s, c] = res;

        // スポット情報の処理
        if (s.status === "fulfilled" && s.value?.items) {
          console.log("✅ スポット取得成功:", s.value.items.length, "件");
          setSpots(s.value.items);
        } else {
          console.warn("⚠️ スポット取得失敗、モックデータを使用");
          setSpots(mockSpots);
        }

        // コンテンツ情報の処理
        if (c.status === "fulfilled" && c.value?.items) {
          console.log("✅ コンテンツ取得成功:", c.value.items.length, "件");
          console.log("📺 コンテンツ詳細:", c.value.items);
          setContents(c.value.items);
        } else {
          console.warn("⚠️ コンテンツ取得失敗、モックデータを使用");
          if (c.status === "rejected") {
            console.error("コンテンツ取得エラー:", c.reason);
          }
          setContents(mockContents);
        }
      }
    );
  }, []);

  // 地図の中心位置が変更された時にスポットを再取得（初期表示時と検索時のみ）
  const handleMapCenterChange = useCallback(
    (
      center: { lat: number; lng: number },
      reason: "initial" | "search" | "move"
    ) => {
      setMapCenter(center);

      // 初期表示時または検索時のみスポットを再取得
      if (reason === "initial" || reason === "search") {
        // 地図中心から半径約1kmのBBoxを作成
        const lat = center.lat;
        const lng = center.lng;
        const delta = 0.01; // 約1km
        const bbox = `${lat - delta},${lng - delta},${lat + delta},${
          lng + delta
        }`;

        Api.spots(bbox)
          .then((response) => {
            if (response?.items) {
              setSpots(response.items);
            }
          })
          .catch((error) => {
            console.warn("スポット取得に失敗:", error);
            // エラー時は既存のスポットを維持
          });
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* ヘッダーを固定表示 */}
      <div className="fixed top-0 left-0 w-full z-[9999]">
        <Header />
      </div>
      {/* ヘッダー分の余白を追加 */}
      <main className="scroll-smooth pt-32">
        <div className="max-w-md mx-auto px-4 mb-6">
          <MapEmbed
            height="320px"
            rounded="1rem"
            onCenterChange={handleMapCenterChange}
          />
        </div>

        <SectionHeader
          title="近くのスポット"
          onMore={() => setIsSpotsPopupOpen(true)}
        />
        <div className="max-w-md mx-auto px-4 space-y-3">
          {(spots ?? Array.from({ length: 3 }))
            .slice(0, 5)
            .map((s, idx) =>
              s ? (
                <SpotCard key={s.id} spot={s} />
              ) : (
                <div
                  key={idx}
                  className="h-16 bg-white rounded-xl animate-pulse shadow-card"
                />
              )
            )}
        </div>

        <SectionHeader
          title="My推しコンテンツ"
          icon="play"
          iconColor="text-teal-500"
          onMore={() => setIsContentsPopupOpen(true)}
        />
        <div className="max-w-md mx-auto px-4 space-y-3 mb-6">
          {(contents ?? Array.from({ length: 3 }))
            .slice(0, 5)
            .map((c, idx) =>
              c ? (
                <ContentCard key={c.id} content={c} />
              ) : (
                <div
                  key={idx}
                  className="h-20 bg-white rounded-xl animate-pulse shadow-card"
                />
              )
            )}
        </div>
      </main>

      <BottomNav />

      {/* スポット一覧ポップアップ */}
      <SpotsPopup
        spots={spots}
        isOpen={isSpotsPopupOpen}
        onClose={() => setIsSpotsPopupOpen(false)}
        title="近くのスポット一覧"
      />

      {/* コンテンツ一覧ポップアップ */}
      <ContentsPopup
        contents={contents}
        isOpen={isContentsPopupOpen}
        onClose={() => setIsContentsPopupOpen(false)}
        title="My推しコンテンツ一覧"
      />
    </div>
  );
}
