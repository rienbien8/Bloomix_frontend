'use client'
// Drive Page (/drive) — Next.js App Router 版
// 依存: npm i @googlemaps/js-api-loader
//      npm i -D @types/google.maps
// Env:  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxxxx
//       NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
// 配置:  app/drive/page.tsx

/* global google */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

// =============================
// Config
// =============================
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

const DEFAULT_CENTER = { lat: 35.6809591, lng: 139.7673068 } // 東京駅
const DEFAULT_ZOOM = 13
const AUTOCOMPLETE_RADIUS_M = 3000
const BUFFER_M_DEFAULT = 1000
const USER_ID_DEFAULT = 1
const TOLERANCE_MIN_DEFAULT = 3

// =============================
// Types
// =============================
interface RouteData {
  type: 'fastest' | 'eco'
  duration_min: number
  distance_km: number
  polyline: string
  advisory?: { fuel_consumption_ml?: number; fuel_saving_pct?: number }
}

interface RoutesResponse {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  routes: RouteData[]
}

interface AutoPrediction { description: string; place_id: string }

interface AlongSpot {
  id: number
  name: string
  lat: number
  lng: number
  is_special: boolean
  oshi_ids?: number[]
  distance_m?: number
}

interface PlaylistItem {
  content_id: number
  title: string
  duration_min: number | null
  lang?: string
  spot_id?: number
  oshi_id?: number
}

// =============================
// Helpers
// =============================
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: any
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

function toMinLabel(min: number | null | undefined) {
  if (min == null) return '-'
  return `${Math.round(min)}分`
}

function getEnvDisplay() {
  const base = API_BASE
  const hasKey = MAPS_API_KEY ? '●' : '×'
  return `API_BASE=${base} / MAPS_KEY=${hasKey}`
}

// =============================
// Page Component
// =============================
export default function Page() {
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const polyFastRef = useRef<google.maps.Polyline | null>(null)
  const polyEcoRef = useRef<google.maps.Polyline | null>(null)
  const destMarkerRef = useRef<google.maps.Marker | null>(null)
  const originMarkerRef = useRef<google.maps.Marker | null>(null)

  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<AutoPrediction[]>([])

  const [routes, setRoutes] = useState<RouteData[]>([])
  const [selectedRoute, setSelectedRoute] = useState<'fastest' | 'eco' | null>(null)
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([])

  const [alongSpots, setAlongSpots] = useState<AlongSpot[]>([])
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([])

  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [loadingAlong, setLoadingAlong] = useState(false)
  const [loadingPlaylist, setLoadingPlaylist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRouteObj = routes.find((r) => r.type === selectedRoute) || null

  // -----------------------------
  // Load Google Maps
  // -----------------------------
  useEffect(() => {
    let cancelled = false
    const loader = new Loader({ apiKey: MAPS_API_KEY, version: 'weekly', libraries: ['places', 'geometry'] })
    loader
      .load()
      .then(async () => {
        if (cancelled) return
        // try geolocation (best-effort)
        await new Promise<void>((resolve) => {
          if (!navigator.geolocation) return resolve()
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
              resolve()
            },
            () => resolve(),
            { timeout: 4000 }
          )
        })
        if (!mapDivRef.current) return
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: center,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })
        infoRef.current = new google.maps.InfoWindow()
      })
      .catch((e) => {
        console.error(e)
        setError('Google Mapsの読み込みに失敗しました。APIキー/Referer制限をご確認ください。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // -----------------------------
  // Search: autocomplete
  // -----------------------------
  const doAutocomplete = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q) return setPredictions([])
        setLoadingSearch(true)
        try {
          const url = new URL(`${API_BASE}/bff/maps/autocomplete`)
          url.searchParams.set('q', q)
          url.searchParams.set('language', 'ja')
          const res = await fetch(url.toString())
          if (!res.ok) throw new Error(`autocomplete ${res.status}`)
          const json = await res.json()
          const arr = json?.predictions || json || []
          const mapped: AutoPrediction[] = arr
            .map((p: any) => ({ description: p.description ?? p.formatted_address ?? p.name, place_id: p.place_id ?? p.id }))
            .filter((x: AutoPrediction) => x.description && x.place_id)
          setPredictions(mapped.slice(0, 8))
        } catch (e) {
          console.error(e)
          setPredictions([])
        } finally {
          setLoadingSearch(false)
        }
      }, 300),
    []
  )

  useEffect(() => {
    doAutocomplete(query.trim())
  }, [query, doAutocomplete])

  const selectPrediction = async (p: AutoPrediction) => {
    setPredictions([])
    setError(null)
    try {
      const url = new URL(`${API_BASE}/bff/maps/place-details`)
      url.searchParams.set('place_id', p.place_id)
      url.searchParams.set('language', 'ja')
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`place-details ${res.status}`)
      const json = await res.json()
      const lat = json?.result?.geometry?.location?.lat ?? json?.location?.lat ?? json?.lat
      const lng = json?.result?.geometry?.location?.lng ?? json?.location?.lng ?? json?.lng
      const viewport = json?.result?.geometry?.viewport ?? json?.viewport
      const name = json?.result?.name ?? p.description

      const map = mapRef.current
      if (!map) return

      // mark destination
      if (destMarkerRef.current) destMarkerRef.current.setMap(null as any)
      destMarkerRef.current = new google.maps.Marker({ map, position: { lat, lng }, title: name })

      if (viewport && viewport.south && viewport.west && viewport.north && viewport.east) {
        const bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(viewport.south, viewport.west),
          new google.maps.LatLng(viewport.north, viewport.east)
        )
        map.fitBounds(bounds)
      } else if (typeof lat === 'number' && typeof lng === 'number') {
        map.setCenter({ lat, lng })
        map.setZoom(14)
      }
    } catch (e) {
      console.error(e)
      setError('目的地情報の取得に失敗しました。')
    }
  }

  // -----------------------------
  // Route fetching
  // -----------------------------
  const fetchRoutes = async () => {
    const map = mapRef.current
    if (!map) return
    if (!destMarkerRef.current) {
      setError('まず目的地を検索・選択してください。')
      return
    }

    // Origin: map center (or origin marker if any)
    let originPos = map.getCenter()!
    if (originMarkerRef.current) originPos = originMarkerRef.current.getPosition()!

    setLoadingRoutes(true)
    setError(null)
    try {
      const url = new URL(`${API_BASE}/bff/maps/route`)
      url.searchParams.set('origin', `${originPos.lat()},${originPos.lng()}`)
      url.searchParams.set('destination', `${destMarkerRef.current.getPosition()!.lat()},${destMarkerRef.current.getPosition()!.lng()}`)
      if (waypoints.length > 0) {
        url.searchParams.set('waypoints', waypoints.map((w) => `${w.lat},${w.lng}`).join('|'))
      }
      url.searchParams.set('alternatives', '1')
      url.searchParams.set('language', 'ja')

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`route ${res.status}`)
      const data: RoutesResponse = await res.json()
      setRoutes(data.routes || [])
      if (!selectedRoute || !data.routes.find((r) => r.type === selectedRoute)) {
        setSelectedRoute('fastest')
      }

      // draw polylines
      const geom = google.maps.geometry as any
      const pathFast = data.routes.find((r) => r.type === 'fastest')?.polyline
      const pathEco = data.routes.find((r) => r.type === 'eco')?.polyline

      if (polyFastRef.current) polyFastRef.current.setMap(null as any)
      if (polyEcoRef.current) polyEcoRef.current.setMap(null as any)

      if (pathFast) {
        polyFastRef.current = new google.maps.Polyline({
          path: geom.encoding.decodePath(pathFast),
          map,
          strokeColor: '#3b82f6', // blue
          strokeOpacity: 0.9,
          strokeWeight: 6,
        })
      }
      if (pathEco) {
        polyEcoRef.current = new google.maps.Polyline({
          path: geom.encoding.decodePath(pathEco),
          map,
          strokeColor: '#22c55e', // green
          strokeOpacity: 0.9,
          strokeWeight: 5,
        })
      }
    } catch (e) {
      console.error(e)
      setError('ルートの取得に失敗しました。')
    } finally {
      setLoadingRoutes(false)
    }
  }

  // -----------------------------
  // Along-route spots
  // -----------------------------
  const alongMarkersRef = useRef<google.maps.Marker[]>([])

  const clearAlongMarkers = () => {
    alongMarkersRef.current.forEach((m) => m.setMap(null as any))
    alongMarkersRef.current = []
  }

  const fetchAlongSpots = async () => {
    const sr = routes.find((r) => r.type === (selectedRoute || 'fastest'))
    if (!sr) {
      setError('先にルートを取得・選択してください。')
      return
    }
    setLoadingAlong(true)
    setError(null)
    try {
      const url = new URL(`${API_BASE}/api/v1/spots/along-route`)
      url.searchParams.set('polyline', sr.polyline)
      url.searchParams.set('buffer_m', String(BUFFER_M_DEFAULT))
      url.searchParams.set('user_id', String(USER_ID_DEFAULT))
      url.searchParams.set('followed_only', '1')
      url.searchParams.set('limit', '200')

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`along-route ${res.status}`)
      const json = await res.json()
      const items: AlongSpot[] = Array.isArray(json) ? json : (json.items ?? [])
      setAlongSpots(items)

      // draw markers
      clearAlongMarkers()
      const map = mapRef.current!
      items.forEach((s) => {
        const m = new google.maps.Marker({
          map,
          position: { lat: s.lat, lng: s.lng },
          title: s.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: s.is_special ? '#f59e0b' : '#8b5cf6', // amber / violet
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        })
        m.addListener('click', () => {
          infoRef.current?.setContent(
            `<div style="min-width:220px">` +
              `<div style="font-weight:600;margin-bottom:4px">${s.name}</div>` +
              `<div style="font-size:12px;color:#444">${s.distance_m ? Math.round(s.distance_m) + 'm' : ''}</div>` +
              `<button id="add-wp" style="margin-top:6px;padding:6px 10px;border-radius:8px;background:#111;color:#fff">経由地に追加</button>` +
            `</div>`
          )
          infoRef.current?.open({ map, anchor: m })
          // wire button after open
          setTimeout(() => {
            const btn = document.getElementById('add-wp')
            if (btn) btn.onclick = () => addWaypoint(s)
          }, 0)
        })
        alongMarkersRef.current.push(m)
      })
    } catch (e) {
      console.error(e)
      setError('沿線スポットの取得に失敗しました。')
    } finally {
      setLoadingAlong(false)
    }
  }

  const addWaypoint = (s: AlongSpot) => {
    setWaypoints((prev) => [...prev, { lat: s.lat, lng: s.lng }])
  }

  // Recalculate routes whenever waypoints change (after initial)
  useEffect(() => {
    if (waypoints.length === 0) return
    fetchRoutes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints])

  // -----------------------------
  // Playlist
  // -----------------------------
  const proposePlaylist = async () => {
    const sr = routes.find((r) => r.type === (selectedRoute || 'fastest'))
    if (!sr) {
      setError('先にルートを選択してください。')
      return
    }
    setLoadingPlaylist(true)
    setError(null)
    try {
      const url = new URL(`${API_BASE}/api/v1/plans/content-priority`)
      url.searchParams.set('target_min', String(Math.round(sr.duration_min)))
      url.searchParams.set('user_id', String(USER_ID_DEFAULT))
      url.searchParams.set('langs', 'ja')
      url.searchParams.set('tolerance_min', String(TOLERANCE_MIN_DEFAULT))
      url.searchParams.set('limit', '50')

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`plan ${res.status}`)
      const json = await res.json()
      const queue: PlaylistItem[] = json?.queue ?? []
      setPlaylist(queue)
    } catch (e) {
      console.error(e)
      setError('プレイリスト提案の取得に失敗しました。')
    } finally {
      setLoadingPlaylist(false)
    }
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%' }}>
      {/* Header/Footer は共通コンポーネントをここでラップしてください */}

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          <input
            placeholder="目的地を検索（例: 東京タワー）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, padding: '6px 8px' }}
          />
          {predictions.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 280, overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {predictions.map((p) => (
                <button key={p.place_id} onClick={() => selectPrediction(p)} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  {p.description}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={fetchRoutes} style={{ borderRadius: 16, padding: '8px 14px', background: '#111', color: '#fff' }}>
          2ルート取得
        </button>
      </div>

      {/* Map */}
      <div ref={mapDivRef} style={{ height: '100%', width: '100%' }} />

      {/* Route cards */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 160, zIndex: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
        {routes.map((r) => (
          <button
            key={r.type}
            onClick={() => setSelectedRoute(r.type)}
            style={{
              minWidth: 160,
              padding: '10px 14px',
              borderRadius: 14,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: selectedRoute === r.type ? '2px solid #111' : '1px solid #e5e7eb',
              background: '#fff',
            }}
            title={r.type}
          >
            <div style={{ fontSize: 12, color: '#6b7280' }}>{r.type === 'fastest' ? '最短' : 'エコ'}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{toMinLabel(r.duration_min)}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{r.distance_km.toFixed(1)} km</div>
            {r.advisory?.fuel_consumption_ml != null && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>燃料: {Math.round(r.advisory.fuel_consumption_ml)} ml</div>
            )}
          </button>
        ))}
      </div>

      {/* Bottom panel */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
        <div style={{ margin: 12, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.96)', boxShadow: '0 -8px 24px rgba(0,0,0,0.08)' }}>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={fetchAlongSpots} disabled={!routes.length} style={{ padding: '8px 12px', borderRadius: 10, background: '#0ea5e9', color: '#fff', border: 'none' }}>
              途中スポット表示（±{BUFFER_M_DEFAULT}m）
            </button>
            <button onClick={proposePlaylist} disabled={!selectedRouteObj} style={{ padding: '8px 12px', borderRadius: 10, background: '#22c55e', color: '#fff', border: 'none' }}>
              プレイリスト提案（{selectedRouteObj ? toMinLabel(selectedRouteObj.duration_min) : '-'}）
            </button>
            <button onClick={() => alert('デモではここで案内開始します。')} style={{ padding: '8px 12px', borderRadius: 10, background: '#111', color: '#fff', border: 'none' }}>
              案内開始（デモ）
            </button>
          </div>

          {/* Waypoints chips */}
          {waypoints.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {waypoints.map((w, i) => (
                <span key={i} style={{ background: '#eef2ff', color: '#3730a3', padding: '4px 8px', borderRadius: 9999, fontSize: 12 }}>
                  WP{i + 1}: {w.lat.toFixed(3)},{w.lng.toFixed(3)}
                </span>
              ))}
            </div>
          )}

          {/* Along-route list */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>沿線のフォロー推しスポット {alongSpots.length ? `(${alongSpots.length}件)` : ''}</div>
            {loadingAlong ? (
              <div>取得中…</div>
            ) : alongSpots.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>未表示。ルート取得後に「途中スポット表示」を押してください。</div>
            ) : (
              <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 8 }}>
                {alongSpots.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{s.distance_m ? `${Math.round(s.distance_m)} m` : ''}</div>
                    </div>
                    <button onClick={() => addWaypoint(s)} style={{ padding: '6px 10px', borderRadius: 8, background: '#111', color: '#fff', border: 'none' }}>
                      経由地に追加
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Playlist list */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>プレイリスト提案</div>
            {loadingPlaylist ? (
              <div>提案中…</div>
            ) : playlist.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>未提案。ルートを選択して「プレイリスト提案」を押してください。</div>
            ) : (
              <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 8 }}>
                {playlist.map((p) => (
                  <div key={p.content_id} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontWeight: 600 }}>{p.title || `コンテンツ #${p.content_id}`}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{toMinLabel(p.duration_min)}</div>
                    </div>
                    {p.lang && <div style={{ fontSize: 12, color: '#6b7280' }}>言語: {p.lang}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status & errors */}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
            <div>
              {loadingRoutes && 'ルート取得中…'}
              {error && <span style={{ color: '#dc2626' }}>　{error}</span>}
            </div>
            <div>{getEnvDisplay()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
