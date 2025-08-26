"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ArtistCard from "../../components/ArtistCard";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";

type Artist = {
  id: string;
  name: string;
  spotsCount: number;
  iconUrl?: string;
};

type Tab = "all" | "following";
type SortKey = "name_asc" | "spots_desc";

export default function FollowListPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [q, setQ] = useState("");
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name_asc");
  const [loading, setLoading] = useState(true);

  const pageSize = 20;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [hasMore, setHasMore] = useState(true);

  const fetchArtists = async (searchQuery: string = "") => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/oshis?q=${searchQuery}&limit=1000`);

      // レスポンスのステータスをチェック
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // JSONレスポンスを試行
      try {
        const data = await response.json();
        const artistsData = data.items || data;
        setArtists(artistsData);

        // hasMoreの初期化
        if (artistsData.length > visibleCount) {
          setHasMore(true);
        } else {
          setHasMore(false);
        }

        // 検索結果が現在の表示件数より少ない場合は、表示件数を調整
        if (artistsData.length < visibleCount) {
          setVisibleCount(artistsData.length);
        }

        // 検索クエリが空の場合は、表示件数を適切に設定
        if (q.trim() === "" && artistsData.length > pageSize) {
          setVisibleCount(pageSize);
          setHasMore(true);
        }

        console.log("Artists loaded:", {
          count: artistsData.length,
          hasMore: artistsData.length > pageSize,
        });
      } catch (jsonError) {
        console.error("JSON parse error:", jsonError);
        // エラー時は空配列を設定
        setArtists([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching artists:", error);
      setArtists([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // 現在のフォロー状態を取得
  const fetchFollows = async () => {
    try {
      const userId = 1; // テスト用ユーザーID
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const baseUrl = isLocal
        ? "http://localhost:8000"
        : "https://app-002-gen10-step3-2-node-oshima7.azurewebsites.net";

      const response = await fetch(`${baseUrl}/api/v1/users/${userId}/oshis`);
      if (response.ok) {
        const data = await response.json();
        const followingIds = data.following_oshi_ids || [];
        const followsState: Record<string, boolean> = {};
        followingIds.forEach((id: number) => {
          followsState[id.toString()] = true;
        });
        setFollows(followsState);
        console.log("フォロー状態を取得:", followsState);
      }
    } catch (error) {
      console.error("フォロー状態の取得に失敗:", error);
      // フォールバック: localStorageから取得
      const storedFollows = localStorage.getItem("follows");
      if (storedFollows) {
        try {
          setFollows(JSON.parse(storedFollows));
        } catch {
          setFollows({});
        }
      }
    }
  };

  useEffect(() => {
    fetchArtists();
    fetchFollows();
  }, []);

  // 検索クエリが変更されたらAPIから再取得
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchArtists(q);

      // 検索クエリが空になった場合は表示件数をリセット
      if (q.trim() === "") {
        setVisibleCount(pageSize);
        setHasMore(true);
      } else {
        // 検索時は表示件数をリセットしない（ユーザビリティ向上）
        setHasMore(true); // 検索時はhasMoreをリセット
      }
    }, 300); // 300msのディレイ

    return () => clearTimeout(timeoutId);
  }, [q]);

  const toggleFollow = async (id: string) => {
    try {
      const isCurrentlyFollowing = follows[id];
      const userId = 1; // テスト用ユーザーID

      // 環境に応じてAPIエンドポイントを切り替え
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const baseUrl = isLocal
        ? "http://localhost:8000"
        : "https://app-002-gen10-step3-2-node-oshima7.azurewebsites.net";
      const apiUrl = `${baseUrl}/api/v1/users/${userId}/oshis/${id}`;

      if (isCurrentlyFollowing) {
        // フォロー解除
        const response = await fetch(apiUrl, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`Failed to unfollow: ${response.status}`);
        }
      } else {
        // フォロー追加
        const response = await fetch(apiUrl, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Failed to follow: ${response.status}`);
        }
      }

      // 成功時のみローカル状態を更新
      setFollows((prev) => {
        const updated = { ...prev, [id]: !prev[id] };
        localStorage.setItem("follows", JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Follow toggle error:", error);
      // エラー時は状態を変更しない
      // 必要に応じてユーザーにエラーを表示
    }
  };

  // 全アーティストからのフォロー数（検索結果に関係なく）
  const followedCount = useMemo(
    () => Object.keys(follows).filter((id) => follows[id]).length,
    [follows]
  );

  const baseList = useMemo(() => {
    return tab === "following" ? artists.filter((a) => follows[a.id]) : artists;
  }, [artists, tab, follows]);

  const filtered = useMemo(() => {
    // 検索クエリが変更されたらAPIから再取得
    if (q.trim() !== "") {
      return baseList;
    }
    return baseList;
  }, [q, baseList]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case "name_asc":
        arr.sort((a, b) => a.name.localeCompare(b.name, "ja"));
        break;
      case "spots_desc":
        arr.sort(
          (a, b) =>
            b.spotsCount - a.spotsCount || a.name.localeCompare(b.name, "ja")
        );
        break;
    }
    return arr;
  }, [filtered, sortKey]);

  // 無限スクロール用の追加読み込み
  const loadMore = useCallback(() => {
    console.log("loadMore called:", {
      hasMore,
      loading,
      visibleCount,
      sortedLength: sorted.length,
    });
    if (hasMore && !loading && visibleCount < sorted.length) {
      setVisibleCount((prev) => {
        const newCount = prev + pageSize;
        console.log("Updating visibleCount:", {
          prev,
          newCount,
          sortedLength: sorted.length,
        });
        // 最後のページに達したかチェック
        if (newCount >= sorted.length) {
          console.log("Setting hasMore to false");
          setHasMore(false);
        }
        return newCount;
      });
    }
  }, [hasMore, loading, visibleCount, sorted.length]);

  // スクロールイベントのリスナー
  useEffect(() => {
    const handleScroll = () => {
      // ページの最下部に近づいたら追加読み込み
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 100
      ) {
        loadMore();
      }
    };

    // 300msのデバウンスでスクロールイベントを最適化
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 300);
    };

    window.addEventListener("scroll", debouncedHandleScroll);
    return () => {
      window.removeEventListener("scroll", debouncedHandleScroll);
      clearTimeout(timeoutId);
    };
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <main className="pt-4">
        {/* 固定表示エリア */}
        <div className="sticky top-20 z-10 bg-gray-50 pb-4">
          <div className="max-w-md mx-auto px-4">
            <input
              type="text"
              placeholder="推しを検索…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full p-2 border rounded-lg mb-3 bg-white shadow-sm"
            />

            <div className="mb-3 flex gap-4">
              <button
                onClick={() => setTab("all")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  tab === "all"
                    ? "bg-sky-500 text-white"
                    : "bg-white text-gray-700"
                } shadow-sm`}
              >
                すべて
              </button>
              <button
                onClick={() => setTab("following")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  tab === "following"
                    ? "bg-sky-500 text-white"
                    : "bg-white text-gray-700"
                } shadow-sm`}
              >
                フォロー中 ({followedCount}){" "}
                {/* 全アーティストからのフォロー数 */}
              </button>
            </div>

            <div className="mb-3 flex justify-end">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm"
              >
                <option value="name_asc">名前順</option>
                <option value="spots_desc">スポット数が多い順</option>
              </select>
            </div>
          </div>
        </div>

        {/* アーティスト一覧エリア */}
        <div className="max-w-md mx-auto px-4">
          <div className="space-y-4">
            {loading ? (
              <p>Loading...</p>
            ) : (
              <>
                {sorted.slice(0, visibleCount).map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    isFollowing={!!follows[artist.id]}
                    onToggleFollow={() => toggleFollow(artist.id)}
                  />
                ))}

                {/* 全件表示完了 */}
                {!hasMore && sorted.length > 0 && (
                  <div className="text-center py-4 text-gray-500">
                    全{sorted.length}件を表示しました
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
