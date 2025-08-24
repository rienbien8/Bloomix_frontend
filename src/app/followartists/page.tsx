'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ArtistCard from '@/components/ArtistCard';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';

type Artist = {
  id: string;
  name: string;
  spotsCount: number;
  iconUrl?: string;
};

type Tab = 'all' | 'following';
type SortKey = 'name_asc' | 'spots_desc' | 'follow_first';

export default function FollowListPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [q, setQ] = useState('');
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [loading, setLoading] = useState(true);

  const pageSize = 20;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const mockArtists: Artist[] = Array.from({ length: 30 }).map((_, i) => ({
    id: `a${i + 1}`,
    name: `アーティスト ${i + 1}`,
    spotsCount: Math.floor(Math.random() * 40) + 1,
    iconUrl: undefined,
  }));

  const fetchArtists = async (searchQuery: string = '') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/oshis?q=${searchQuery}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Invalid response type');
      }
      const data = await response.json();
      setArtists(data);
    } catch (error) {
      console.error('Error fetching artists:', error);
      setArtists(mockArtists);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
    const storedFollows = localStorage.getItem('follows');
    if (storedFollows) {
      try {
        setFollows(JSON.parse(storedFollows));
      } catch {
        setFollows({});
      }
    }
  }, []);

  const toggleFollow = (id: string) => {
    setFollows(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem('follows', JSON.stringify(updated));
      return updated;
    });
  };

  const followedCount = useMemo(() => artists.filter(a => follows[a.id]).length, [artists, follows]);

  const baseList = useMemo(() => {
    return tab === 'following' ? artists.filter(a => follows[a.id]) : artists;
  }, [artists, tab, follows]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return baseList;
    return baseList.filter(a => a.name.toLowerCase().includes(text));
  }, [q, baseList]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'name_asc':
        arr.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        break;
      case 'spots_desc':
        arr.sort((a, b) => b.spotsCount - a.spotsCount || a.name.localeCompare(b.name, 'ja'));
        break;
      case 'follow_first':
        arr.sort((a, b) => {
          const fa = follows[a.id] ? 1 : 0;
          const fb = follows[b.id] ? 1 : 0;
          if (fb !== fa) return fb - fa;
          return a.name.localeCompare(b.name, 'ja');
        });
        break;
    }
    return arr;
  }, [filtered, sortKey, follows]);

  const handleBack = () => {
    if (history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <main className="pt-4">
        <div className="max-w-md mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={handleBack} className="text-gray-600 hover:text-gray-800">
              ← 戻る
            </button>
            <h1 className="text-xl font-bold text-gray-800">フォロー アーティスト</h1>
          </div>

          <input
            type="text"
            placeholder="推しを検索…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full p-2 border rounded-lg mb-3"
          />

          <div className="mb-3 flex gap-4">
            <button
              onClick={() => setTab('all')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'all' ? 'bg-sky-500 text-white' : 'text-gray-700'}`}
            >
              すべて
            </button>
            <button
              onClick={() => setTab('following')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${tab === 'following' ? 'bg-sky-500 text-white' : 'text-gray-700'}`}
            >
              フォロー中 ({followedCount})
            </button>
          </div>

          <div className="mb-3 flex justify-end">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
            >
              <option value="name_asc">名前順</option>
              <option value="spots_desc">スポット数が多い順</option>
              <option value="follow_first">フォロー中を上に表示</option>
            </select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p>Loading...</p>
            ) : (
              sorted.slice(0, visibleCount).map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  isFollowing={!!follows[artist.id]}
                  onToggleFollow={() => toggleFollow(artist.id)}
                />
              ))
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
