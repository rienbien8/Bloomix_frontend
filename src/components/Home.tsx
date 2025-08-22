"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";
import HeroMapCard from "./HeroMapCard";
import SectionHeader from "./SectionHeader";
import SpotCard from "./SpotCard";
import ContentCard from "./ContentCard";
import BottomNav from "./BottomNav";
import { Api } from "../modules/api";
import { mockSpots, mockContents } from "../modules/mock";
import type { Spot, Content } from "../modules/types";
import MapEmbed from "./MapEmbed";

export default function Home() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [contents, setContents] = useState<Content[] | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 並列で呼び出し。失敗時はモックで補う
    Promise.allSettled([Api.spots(), Api.contents()]).then((res) => {
      const [s, c] = res;
      if (s.status === "fulfilled" && s.value?.items) setSpots(s.value.items);
      else setSpots(mockSpots);

      if (c.status === "fulfilled" && Array.isArray(c.value))
        setContents(c.value);
      else setContents(mockContents);
    });
  }, []);

  // 地図の中心位置が変更された時にスポットを再取得（初期表示時と検索時のみ）
  const handleMapCenterChange = useCallback((center: { lat: number; lng: number }, reason: 'initial' | 'search' | 'move') => {
    setMapCenter(center);
    
    // 初期表示時または検索時のみスポットを再取得
    if (reason === 'initial' || reason === 'search') {
      // 地図中心から半径約1kmのBBoxを作成
      const lat = center.lat;
      const lng = center.lng;
      const delta = 0.01; // 約1km
      const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
      
      Api.spots(bbox).then((response) => {
        if (response?.items) {
          setSpots(response.items);
        }
      }).catch((error) => {
        console.warn("スポット取得に失敗:", error);
        // エラー時は既存のスポットを維持
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* ヘッダーを固定表示 */}
      <div className="fixed top-0 left-0 w-full z-10">
      <Header /></div>
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
          onMore={() => router.push("/spots")}
        />
        <div className="max-w-md mx-auto px-4 space-y-3">
          {(spots ?? Array.from({ length: 3 })).map((s, idx) =>
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

        <SectionHeader title="My推しコンテンツ" />
        <div className="max-w-md mx-auto px-4 space-y-3 mb-6">
          {(contents ?? Array.from({ length: 3 })).map((c, idx) =>
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
    </div>
  );
}
