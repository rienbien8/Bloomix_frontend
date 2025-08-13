import type { Spot, Content, Oshi } from './types'

const BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || ''

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// エンドポイント（FastAPI: /api/v1/...）
export const Api = {
  spots: () => get<Spot[]>(`/api/v1/spots`),
  oshis: () => get<Oshi[]>(`/api/v1/oshis`),
  contents: () => get<Content[]>(`/api/v1/contents`),
  // ルートは今回のホーム画面では未使用だが、将来のために定義
  routes: () => get<any[]>(`/api/v1/routes`),
}