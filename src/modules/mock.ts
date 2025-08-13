import type { Spot, Content } from './types'

export const mockSpots: Spot[] = [
  { id: 1, name: 'HONDAセレクト', lat: 35.0, lng: 139.0, type: 'SELECT', is_special: true, description: '推しチームB', address: '東京都渋谷区' },
  { id: 2, name: 'MV撮影地', lat: 35.1, lng: 139.1, type: 'RECOMMEND', is_special: false, description: '推しアーティストA', address: '東京都目黒区' },
  { id: 3, name: 'ドラマロケ地A', lat: 35.2, lng: 139.2, type: 'RECOMMEND', is_special: false, description: '推し俳優C', address: '東京都港区' },
]

export const mockContents: Content[] = [
  { id: 11, title: '新曲「ドライブソング」', media_type: 'youtube', youtube_id: 'dQw4w9WgXcQ', duration_min: 3, thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  { id: 12, title: 'ハイライト映像', media_type: 'youtube', youtube_id: '3GwjfUFyY6M', duration_min: 5, thumbnail_url: 'https://i.ytimg.com/vi/3GwjfUFyY6M/hqdefault.jpg' },
  { id: 13, title: 'TV番組「春の旅」', media_type: 'youtube', youtube_id: 'oHg5SJYRHA0', duration_min: 5, thumbnail_url: 'https://i.ytimg.com/vi/oHg5SJYRHA0/hqdefault.jpg' },
]