/** ER図に基づく型定義（フロント最小限） */

export type Oshi = {
  id: number;
  name: string;
  category: string;
  image_url?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Spot = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type?: "SELECT" | "RECOMMEND" | string;
  is_special?: boolean;
  address?: string | null;
  place_id?: string | null;
  description?: string | null;
  oshi_id?: number | null;
  oshis?: Oshi[]; // スポットに関連する推しの配列
  created_at?: string;
  updated_at?: string;
};

export type Content = {
  id: number;
  title: string;
  media_type: string; // youtube(MVP) など
  media_url?: string | null;
  youtube_id?: string | null;
  lang?: string | null;
  thumbnail_url?: string | null;
  created_at?: string;
  updated_at?: string;
  duration_min?: number | null;
};
