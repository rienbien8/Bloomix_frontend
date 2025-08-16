"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import SpotCard from "../components/SpotCard";
import BottomNav from "../components/BottomNav";
import { Api } from "../modules/api";
import { mockSpots } from "../modules/mock";
import type { Spot } from "../modules/types";

export default function SpotsList() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // バックエンドのGET /api/v1/spotsを呼び出し
    Api.spots()
      .then((response) => {
        // APIレスポンスの構造: {count: number, items: Spot[]}
        setSpots(response.items);
        setLoading(false);
      })
      .catch((error) => {
        console.warn("API呼び出しに失敗、モックデータを使用:", error);
        setSpots(mockSpots);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <main className="scroll-smooth">
        <div className="max-w-md mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-800"
            >
              ← 戻る
            </button>
            <h1 className="text-xl font-bold text-gray-800">スポット一覧</h1>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-16 bg-white rounded-xl animate-pulse shadow-card"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {spots?.map((spot) => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
