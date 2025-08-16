"use client";

import { useEffect, useState } from "react";
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

export default function Home() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [contents, setContents] = useState<Content[] | null>(null);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />
      <main className="scroll-smooth">
        <HeroMapCard />

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
