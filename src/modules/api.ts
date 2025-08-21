import type { Spot, Content, Oshi, ContentItem } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// エンドポイント（FastAPI: /api/v1/...）
export const Api = {
  // 渋谷周辺のデフォルトbbox（緯度35.65-35.67、経度139.69-139.72）
  spots: (bbox?: string) => {
    const defaultBbox = "35.65,139.69,35.67,139.72";
    const bboxParam = bbox || defaultBbox;
    return get<{ count: number; items: Spot[] }>(
      `/api/v1/spots?bbox=${bboxParam}`
    );
  },
  oshis: () => get<Oshi[]>(`/api/v1/oshis`),
  contents: () => get<Content[]>(`/api/v1/contents`),
  // ルートは今回のホーム画面では未使用だが、将来のために定義
  routes: () => get<any[]>(`/api/v1/routes`),
};

export async function getContents(): Promise<ContentItem[]> {
  const response = await fetch("/api/contents");
  if (!response.ok) {
    throw new Error("Failed to fetch contents");
  }
  return response.json();
}
