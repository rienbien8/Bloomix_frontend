"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import Container from "../../components/Container";
import BottomSheet from "../../components/BottomSheet";
import ContentListItem from "../../components/ContentListItem";
import { getContents } from "../../modules/api";
import type { ContentItem } from "../../modules/types";

export default function ContentsPage() {
  // Data
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [query, setQuery] = useState("");

  // Config
  const pageSize = 10;

  // Derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.title?.toLowerCase().includes(q));
  }, [items, query]);

  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  // Fetch
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getContents({ limit: 200 }); // 引数を渡す
        setItems(Array.isArray(res) ? res : []);
      } finally {
        setLoading(false);
      }
    })().catch(() => setLoading(false));
  }, []);

  // Reset to first page when filter changes
  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="min-h-screen bg-white">
      {/* 固定ヘッダー */}
      <Header />

      {/* 上余白=ヘッダー, 下余白=ボトムナビ */}
      <main className="pt-14 pb-20">
        <Container>
          {/* タイトル & 検索（スマホ対応） */}
          <header className="sticky top-14 z-10 bg-white/85 backdrop-blur">
            <div className="flex items-center justify-between py-3">
              <h1 className="text-[15px] font-semibold text-zinc-800">
                My推しコンテンツ
              </h1>
            </div>
            <div className="pb-2">
              <label className="block">
                <input
                  type="search"
                  inputMode="search"
                  placeholder="コンテンツを検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-[14px] outline-none placeholder:text-zinc-400"
                />
              </label>
            </div>
          </header>

          {/* リスト（白・角丸・影） */}
          <section className="space-y-3 pt-2">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-zinc-100" />
              ))}

            {!loading &&
              view.map((c) => (
                <ContentListItem
                  key={c.id}
                  item={c}
                  onClick={() => setSelected(c)}
                  onPlay={() => setSelected(c)}
                />
              ))}

            {!loading && view.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500">
                コンテンツがありません
              </div>
            )}
          </section>

          {/* ページャ */}
          {!loading && filtered.length > pageSize && (
            <nav className="sticky bottom-16 mt-6 flex items-center justify-center gap-2 bg-gradient-to-t from-white via-white/70 to-transparent py-3">
              <button
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                最初に戻る
              </button>
              <button
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                戻る
              </button>
              <span className="text-sm text-zinc-600">
                {page} / {maxPage}
              </span>
              <button
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                disabled={page === maxPage}
              >
                次へ
              </button>
            </nav>
          )}
        </Container>
      </main>

      {/* 固定ボトムナビ */}
      <BottomNav />

      {/* 詳細 BottomSheet（モバイル向けポップアップ） */}
      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        heightPct={70}
        title="コンテンツ詳細"
      >
        {selected && (
          <div className="space-y-3">
            <div className="text-lg font-semibold">{selected.title}</div>
            <dl className="grid grid-cols-3 gap-x-2 text-sm">
              <dt className="text-zinc-500">ID</dt>
              <dd className="col-span-2 break-all">{selected.id}</dd>
              <dt className="text-zinc-500">Spot</dt>
              <dd className="col-span-2 break-all">{selected.spot_id}</dd>
              <dt className="text-zinc-500">Oshi</dt>
              <dd className="col-span-2 break-all">{selected.oshi_id ?? "-"}</dd>
              <dt className="text-zinc-500">Duration</dt>
              <dd className="col-span-2">{selected.duration_sec ?? "-"}</dd>
            </dl>
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-blue-600"
              >
                外部リンクを開く
              </a>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

export async function getContents(params: { limit: number }): Promise<ContentItem[]> {
  // 関数の実装
}
