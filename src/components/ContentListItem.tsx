'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

/** このページ専用の簡単な型 */
type Content = {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;          // 画像パス（/public 配下推奨）
  url: string;                // 外部リンク（YouTube / Spotify）
  source: 'youtube' | 'spotify';
};

/** 一旦モック（必要に応じてAPI化して差し替え可） */
const mockContents: Content[] = [
  {
    id: 'c1',
    title: '新曲「ドライブソング」',
    duration: '3分',
    thumbnail: '/images/content01.jpg', // 無ければ後述のfallbackが効きます
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'youtube',
  },
  {
    id: 'c2',
    title: 'ハイライト映像',
    duration: '5分',
    thumbnail: '/images/content02.jpg',
    url: 'https://open.spotify.com/track/7GhIk7Il098yCjg4BQjzvb',
    source: 'spotify',
  },
  {
    id: 'c3',
    title: 'TV番組「春の旅」',
    duration: '5分',
    thumbnail: '/images/content03.jpg',
    url: 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
    source: 'youtube',
  },
];

export default function ContentsPage() {
  const router = useRouter();
  const [contents, setContents] = useState<Content[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ここをAPI呼び出しに差し替え可
    // Api.contents().then(res => setContents(res.items)).finally(() => setLoading(false))
    const timer = setTimeout(() => {
      setContents(mockContents);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    // 履歴があれば戻る／無ければホームへ
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <main className="scroll-smooth">
        <div className="max-w-md mx-auto px-4 pt-4">
          {/* 見出し行 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-800"
                aria-label="戻る"
              >
                ← 戻る
              </button>
              <h1 className="text-xl font-bold text-gray-800">My推しコンテンツ</h1>
            </div>

            {/* 一覧へ（ダミー：このページ自身なので#に） */}
            <a
              href="#"
              className="text-sky-500 hover:text-sky-600 text-sm font-medium"
            >
              一覧へ
            </a>
          </div>

          {/* リスト */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-white rounded-2xl shadow-sm animate-pulse"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-4">
              {contents?.map((c) => (
                <li key={c.id}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 bg-white rounded-2xl px-3 py-3 shadow-sm hover:shadow-md transition"
                  >
                    {/* 左：サムネ + タイトル */}
                    <div className="flex items-center gap-3">
                      {/* サムネ（fallback付き） */}
                      {/* 画像が無い場合はグレーの丸枠にアイコン風表示 */}
                      {c.thumbnail ? (
                        // Next/Image を使う場合は <Image /> に置換してください
                        <img
                          src={c.thumbnail}
                          alt={c.title}
                          className="w-14 h-14 rounded-xl object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gray-200 grid place-items-center text-gray-500">
                          🎵
                        </div>
                      )}

                      <div className="flex flex-col">
                        <p className="text-base font-semibold text-gray-900">
                          {c.title}
                        </p>
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
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
