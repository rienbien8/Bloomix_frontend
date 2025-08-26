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
    // ユーザーの推し情報を取得してから、フォローしているアーティストのコンテンツを取得
    const initializeData = async () => {
      try {
        // 1. ユーザーの推し情報を取得（一度だけ）
        const oshiIds = await fetchUserOshis();

        // 2. スポット情報を取得（初期表示時のみ、推し情報は含めない）
        try {
          // フォロー推しフィルタリングを一時的に無効化（全スポット表示）
          const defaultBbox = "35.65,139.69,35.67,139.72"; // 渋谷周辺
          console.log("🏠 初期化時のBBox:", defaultBbox);
          const spotsResponse = await Api.spots(defaultBbox, {
            user_id: 1, // テスト用ユーザーID
            followed_only: 1, // フォロー推しのみ
            limit: 20,
          });
          if (spotsResponse?.items) {
            console.log(
              "✅ フォロー推しスポット取得成功:",
              spotsResponse.items.length,
              "件"
            );
            console.log(
              "🏠 初期化時のスポット:",
              spotsResponse.items.map((s) => ({ id: s.id, name: s.name }))
            );
            setSpots(spotsResponse.items);
          } else {
            console.warn("⚠️ フォロー推しスポット取得失敗、モックデータを使用");
            setSpots(mockSpots);
          }
        } catch (error) {
          console.warn(
            "⚠️ フォロー推しスポット取得失敗、モックデータを使用:",
            error
          );
          setSpots(mockSpots);
        }

        // 3. フォローしているアーティストのコンテンツを取得（必要な場合のみ）
        if (oshiIds.length > 0) {
          // テスト用ユーザーID（実際の実装では認証システムから取得）
          const userId = 1;
          try {
            const userContentsResponse = await Api.userContents(userId, {
              limit: 30,
            });
            if (userContentsResponse?.items) {
              console.log(
                "✅ マイコンテンツ取得成功:",
                userContentsResponse.items.length,
                "件"
              );
              setContents(userContentsResponse.items);
            } else {
              console.log("📝 マイコンテンツが見つかりません");
              setContents([]);
            }
          } catch (error) {
            console.warn("⚠️ マイコンテンツ取得失敗:", error);
            setContents([]);
          }
        } else {
          console.log(
            "📝 フォローしているアーティストがいないため、マイコンテンツは表示しません"
          );
          setContents([]);
        }
      } catch (error) {
        console.error("データ初期化エラー:", error);
        // エラー時はモックデータを使用
        setSpots(mockSpots);
        setContents(mockContents);
      }
    };

    initializeData();
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

        // デバウンス処理を追加（連続した呼び出しを防ぐ）
        const timeoutId = setTimeout(() => {
          Api.spots(bbox, {
            user_id: 1, // テスト用ユーザーID
            followed_only: 1, // フォロー推しのみ
            limit: 20,
          })
            .then((response) => {
              if (response?.items) {
                console.log(
                  "🗺️ 地図中心変更によるフォロー推しスポット更新:",
                  response.items.length,
                  "件"
                );
                setSpots(response.items);
              }
            })
            .catch((error) => {
              console.warn("フォロー推しスポット取得に失敗:", error);
              // エラー時は既存のスポットを維持
            });
        }, 500); // 500msのデバウンス

        // クリーンアップ関数
        return () => clearTimeout(timeoutId);
      }
    },
    []
  );

  // 地図のスポット更新時のコールバック
  const handleSpotsUpdate = useCallback(
    (updatedSpots: any[]) => {
      console.log("🗺️ 地図からのスポット更新:", updatedSpots.length, "件");
      console.log(
        "🗺️ 更新されたスポット:",
        updatedSpots.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
        }))
      );
      console.log("🗺️ 現在のspots state:", spots?.length, "件");
      setSpots(updatedSpots);
    },
    [spots]
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
            user_id={1} // テスト用ユーザーID
            followed_only={1} // フォロー推しのみ表示
            onCenterChange={handleMapCenterChange}
            onSpotsUpdate={handleSpotsUpdate}
          />
        </div>

        <SectionHeader
          title={`近くのスポット${
            spots && spots.length > 5 ? ` (${spots.length}件)` : ""
          }`}
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
          title={`My推しコンテンツ${
            contents && contents.length > 5 ? ` (${contents.length}件)` : ""
          }`}
          icon="play"
          iconColor="text-teal-500"
          onMore={() => setIsContentsPopupOpen(true)}
        />
        <div className="max-w-md mx-auto px-4 space-y-3 mb-6">
          {contents && contents.length > 0 ? (
            contents
              .slice(0, 5) // ホーム画面では5件まで表示
              .map((c) => <ContentCard key={c.id} content={c} />)
          ) : contents === null ? (
            // ローディング中
            Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 bg-white rounded-xl animate-pulse shadow-card"
              />
            ))
          ) : (
            // フォローしているアーティストがいない場合
            <div className="bg-white rounded-xl p-6 text-center shadow-card">
              <div className="text-gray-500 mb-2">🎵</div>
              <div className="text-sm text-gray-600 mb-2">
                フォローしているアーティストがいません
              </div>
              <div className="text-xs text-gray-400">
                アーティストをフォローすると、ここにコンテンツが表示されます
              </div>
            </div>
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
        title={`My推しコンテンツ一覧${
          contents && contents.length > 0 ? ` (${contents.length}件)` : ""
        }`}
      />
    </div>
  );
}
