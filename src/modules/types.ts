/** ER図に基づく型定義（フロント最小限） */

export type Oshi = {
  id: number
  name: string
  category: string
  image_url?: string | null
  description?: string | null
  created_at?: string
  updated_at?: string
}

export type Spot = {
  id: number
  name: string
  lat: number
  lng: number
  type?: 'SELECT' | 'RECOMMEND' | string
  is_special?: boolean
  address?: string | null
  place_id?: string | null
  description?: string | null
  oshi_id?: number | null
  created_at?: string
  updated_at?: string
}

export type Content = {
  id: number
  title: string
  media_type: string // youtube(MVP) など
  media_url?: string | null
  youtube_id?: string | null
  lang?: string | null
  thumbnail_url?: string | null
  created_at?: string
  updated_at?: string
  duration_min?: number | null
}

export type ContentItem = {
  id: number;
  title: string;
  description?: string;
  duration_sec?: number;
  spot_id: number;
  oshi_id?: number;
  url?: string; // オプショナルプロパティとして追加
};