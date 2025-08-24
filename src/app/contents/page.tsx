'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';  // ここを追加
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

/** コンテンツ型：artistId を追加（フォロー判定に使用） */
type Content = {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;          // 画像パス（/public 配下推奨）
  url: string;                // 外部リンク（YouTube / Spotify）
  source: 'youtube' | 'spotify';
  artistId?: string; // ← フォロー一覧のアーティストIDと一致させる
};

/** モック（例）：artistId を必ず付与しておく */
const mockContents: Content[] = [
  {
    id: 'c1',
    title: '新曲「ドライブソング」',
    duration: '3分',
    thumbnail: '/images/content01.jpg', // 無ければ後述のfallbackが効きます
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'youtube',
    artistId: 'a1',
  },
  {
    id: 'c2',
    title: 'ハイライト映像',
    duration: '5分',
    thumbnail: '/images/content02.jpg',
    url: 'https://open.spotify.com/track/7GhIk7Il098yCjg4BQjzvb',
    source: 'spotify',
    artistId: 'a2',
  },
  {
    id: 'c3',
    title: 'TV番組「春の旅」',
    duration: '5分',
    thumbnail: '/images/content03.jpg',
    url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
    source: 'youtube',
    artistId: 'a3',
  },
  // 追加のモックデータ...
];

export default function ContentsPage() {
  const router = useRouter();  // routerを定義
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);  // ページ管理のためのステート

  useEffect(() => {
    // ここをAPI呼び出しに差し替え
    const fetchContents = async () => {
      try {
        const response = await fetch(`/api/v1/users/{user_id}/oshis?page=${page}`);
        const data = await response.json();
        setContents(data);  // APIレスポンスに基づいてコンテンツをセット
        setLoading(false);
      } catch (error) {
        console.error("Error fetching contents:", error);
        setContents(mockContents);  // APIエラー時はモックデータを使用
        setLoading(false);
      }
    };
    fetchContents();
  }, [page]);

  const handleBack = () => {
    if (history.length > 1) router.back();
    else router.push('/');
  };

  // 10件ごとにページネーション
  const paginatedContents = contents.slice((page - 1) * 10, page * 10);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <main className="scroll-smooth">
        <div className="max-w-md mx-auto px-4 pt-4">
          {/* 見出し行 */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBack}
              className="text-sky-500 hover:text-gray-800"
              aria-label="戻る"
            >
              ← 戻る
            </button>
            <h1 className="text-xl font-bold text-gray-800">My推しコンテンツ</h1>
          </div>

          {/* リスト */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl shadow-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="space-y-4">
              {paginatedContents.map((c) => (
                <li key={c.id}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 bg-white rounded-2xl px-3 py-3 shadow-sm hover:shadow-md transition"
                  >
                    {/* 左：サムネ + タイトル */}
                    <div className="flex items-center gap-3">
                      {c.thumbnail ? (
                        <img
                          src={c.thumbnail}
                          alt={c.title}
                          className="w-14 h-14 rounded-xl object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gray-200 grid place-items-center text-gray-500">
                          🎵
                        </div>
                      )}

                      <div className="flex flex-col">
                        <p className="text-base font-semibold text-gray-900">{c.title}</p>
                        <span className="text-sm text-gray-500">{c.duration}</span>
                      </div>
                    </div>

                    {/* 右：再生ボタン風（外部リンク） */}
                    <div
                      className="shrink-0 w-10 h-10 rounded-full bg-gray-100 grid place-items-center"
                      aria-hidden
                    >
                      {/* 再生アイコン：シンプルな▶︎ */}
                      <span className="translate-x-[1px]">▶︎</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* ページネーション */}
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg"
            >
              前へ
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={contents.length <= page * 10}
              className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg"
            >
              次へ
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
