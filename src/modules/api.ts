import type { Spot, Content, Oshi } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";

async function get<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
    }
    return res.json() as Promise<T>;
  } catch (error) {
    console.error(`API呼び出しエラー (${path}):`, error);
    throw error;
  }
}

// エンドポイント（FastAPI: /api/v1/...）
export const Api = {
  // スポット一覧を取得
  spots: (
    bbox?: string,
    params?: {
      is_special?: number;
      q?: string;
      origin?: string;
      user_id?: number;
      followed_only?: number;
      limit?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();

    // bboxが未指定の場合はデフォルト値を使用
    const defaultBbox = "35.65,139.69,35.67,139.72"; // 渋谷周辺
    const bboxParam = bbox || defaultBbox;
    searchParams.append("bbox", bboxParam);

    if (params?.is_special !== undefined)
      searchParams.append("is_special", params.is_special.toString());
    if (params?.q) searchParams.append("q", params.q);
    if (params?.origin) searchParams.append("origin", params.origin);
    if (params?.user_id)
      searchParams.append("user_id", params.user_id.toString());
    if (params?.followed_only !== undefined)
      searchParams.append("followed_only", params.followed_only.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    return get<{ count: number; items: Spot[] }>(
      `/api/v1/spots?${queryString}`
    );
  },
  oshis: () => get<{ count: number; items: Oshi[] }>(`/api/v1/oshis`),
  contents: (params?: { oshi_id?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.oshi_id)
      searchParams.append("oshi_id", params.oshi_id.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const url = queryString
      ? `/api/v1/contents?${queryString}`
      : "/api/v1/contents";
    return get<{ count: number; items: Content[] }>(url);
  },
  // ユーザーがフォローしているアーティストのコンテンツを取得
  userContents: (userId: number, params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const url = queryString
      ? `/api/v1/users/${userId}/contents?${queryString}`
      : `/api/v1/users/${userId}/contents`;
    return get<{ count: number; items: Content[] }>(url);
  },
  // ルートは今回のホーム画面では未使用だが、将来のために定義
  routes: () => get<any[]>(`/api/v1/routes`),
};
