"use client";
// Drive Page (/drive) — Next.js App Router 版
// 依存: npm i @googlemaps/js-api-loader
//      npm i -D @types/google.maps
// Env:  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=xxxxx
//       NEXT_PUBLIC_API_BASE_URL_URL=http://127.0.0.1:8000
// 配置:  app/drive/page.tsx

/* global google */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";

// =============================
// Config
// =============================
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = { lat: 35.6809591, lng: 139.7673068 }; // 東京駅
const DEFAULT_ZOOM = 13;
const AUTOCOMPLETE_RADIUS_M = 3000;
const BUFFER_M_DEFAULT = 1000;
const USER_ID_DEFAULT = 1;
const TOLERANCE_MIN_DEFAULT = 3;

// =============================
// Types
// =============================
interface RouteData {
  type: "fastest" | "eco";
  duration_min: number;
  distance_km: number;
  polyline: string;
  advisory?: { fuel_consumption_ml?: number; fuel_saving_pct?: number };
}

interface RoutesResponse {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  routes: RouteData[];
}

interface AutoPrediction {
  description: string;
  place_id: string;
}

interface AlongSpot {
  id: number;
  name: string;
  lat: number;
  lng: number;
  is_special: boolean;
  oshi_ids?: number[];
  distance_m?: number;
}

interface PlaylistItem {
  content_id: number;
  title: string;
  duration_min: number | null;
  lang?: string;
  spot_id?: number;
  oshi_id?: number;
}

// =============================
// Helpers
// =============================
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function toMinLabel(min: number | null | undefined) {
  if (min == null) return "-";
  return `${Math.round(min)}分`;
}

function getEnvDisplay() {
  const base = API_BASE;
  const hasKey = MAPS_API_KEY ? "●" : "×";
  return `API_BASE=${base} / MAPS_KEY=${hasKey}`;
}

// =============================
// Page Component
// =============================
export default function Page() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const infoRef = useRef<any | null>(null);
  const polyFastRef = useRef<any | null>(null);
  const polyEcoRef = useRef<any | null>(null);
  const destMarkerRef = useRef<any | null>(null);
  const originMarkerRef = useRef<any | null>(null);

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<AutoPrediction[]>([]);

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<"fastest" | "eco" | null>(
    null
  );
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>(
    []
  );

  const [alongSpots, setAlongSpots] = useState<AlongSpot[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingAlong, setLoadingAlong] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRouteObj = routes.find((r) => r.type === selectedRoute) || null;

  // -----------------------------
  // Load Google Maps
  // -----------------------------
  useEffect(() => {
    let cancelled = false;
    const loader = new Loader({
      apiKey: MAPS_API_KEY,
      version: "weekly",
      libraries: ["places", "geometry"],
    });
    loader
      .load()
      .then(async () => {
        if (cancelled) return;
        // try geolocation (best-effort)
        await new Promise<void>((resolve) => {
          if (!navigator.geolocation) return resolve();
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCenter({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
              resolve();
            },
            () => resolve(),
            { timeout: 4000 }
          );
        });
        if (!mapDivRef.current) return;
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: center,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        infoRef.current = new google.maps.InfoWindow();
      })
      .catch((e) => {
        console.error(e);
        setError(
          "Google Mapsの読み込みに失敗しました。APIキー/Referer制限をご確認ください。"
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------
  // Search: autocomplete
  // -----------------------------
  const doAutocomplete = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q) return setPredictions([]);
        setLoadingSearch(true);
        try {
          const url = new URL(`${API_BASE}/bff/maps/autocomplete`);
          url.searchParams.set("q", q);
          url.searchParams.set("language", "ja");
          const res = await fetch(url.toString());
          if (!res.ok) throw new Error(`autocomplete ${res.status}`);
          const json = await res.json();
          const arr = json?.predictions || json || [];
          const mapped: AutoPrediction[] = arr
            .map((p: any) => ({
              description: p.description ?? p.formatted_address ?? p.name,
              place_id: p.place_id ?? p.id,
            }))
            .filter((x: AutoPrediction) => x.description && x.place_id);
          setPredictions(mapped.slice(0, 8));
        } catch (e) {
          console.error(e);
          setPredictions([]);
        } finally {
          setLoadingSearch(false);
        }
      }, 300),
    []
  );

  useEffect(() => {
    doAutocomplete(query.trim());
  }, [query, doAutocomplete]);

  const selectPrediction = async (p: AutoPrediction) => {
    setPredictions([]);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/bff/maps/place-details`);
      url.searchParams.set("place_id", p.place_id);
      url.searchParams.set("language", "ja");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`place-details ${res.status}`);
      const json = await res.json();
      const name = json?.result?.name ?? p.description;

      // より堅牢な座標取得
      const getCoordinates = (json: any) => {
        // 複数のパターンを試行
        const patterns = [
          json?.result?.geometry?.location,
          json?.geometry?.location,
          json?.location,
          json?.result?.location,
          { lat: json?.lat, lng: json?.lng },
          { lat: json?.latitude, lng: json?.longitude },
        ];

        for (const pattern of patterns) {
          if (
            pattern?.lat &&
            pattern?.lng &&
            typeof pattern.lat === "number" &&
            typeof pattern.lng === "number" &&
            !isNaN(pattern.lat) &&
            !isNaN(pattern.lng)
          ) {
            return { lat: pattern.lat, lng: pattern.lng };
          }
        }

        return null;
      };

      const coords = getCoordinates(json);
      if (!coords) {
        console.error("No valid coordinates found in response:", json);
        setError("座標情報が見つかりませんでした。");
        return;
      }

      // 検証済みの座標でマーカー作成
      const map = mapRef.current;
      if (!map) return;

      // mark destination
      if (destMarkerRef.current) destMarkerRef.current.setMap(null as any);
      try {
        destMarkerRef.current = new google.maps.Marker({
          map,
          position: coords,
          title: name,
        });
      } catch (error) {
        console.error("Marker creation failed:", error, {
          lat: coords.lat,
          lng: coords.lng,
        });
        setError("マーカーの作成に失敗しました。座標を確認してください。");
        return;
      }

      // 地図の中心を目的地に設定
      if (typeof coords.lat === "number" && typeof coords.lng === "number") {
        map.setCenter({ lat: coords.lat, lng: coords.lng });
        map.setZoom(14);
      }
    } catch (e) {
      console.error(e);
      setError("目的地情報の取得に失敗しました。");
    }
  };

  // -----------------------------
  // Route fetching
  // -----------------------------
  const fetchRoutes = async () => {
    const map = mapRef.current;
    if (!map) return;
    if (!destMarkerRef.current) {
      setError("まず目的地を検索・選択してください。");
      return;
    }

    // Origin: map center (or origin marker if any)
    let originPos = map.getCenter()!;
    if (originMarkerRef.current)
      originPos = (originMarkerRef.current as any).getPosition()!;

    setLoadingRoutes(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/bff/maps/route`);
      url.searchParams.set("origin", `${originPos.lat()},${originPos.lng()}`);
      url.searchParams.set(
        "destination",
        `${(destMarkerRef.current as any).getPosition()!.lat()},${(
          destMarkerRef.current as any
        )
          .getPosition()!
          .lng()}`
      );
      if (waypoints.length > 0) {
        url.searchParams.set(
          "waypoints",
          waypoints.map((w) => `${w.lat},${w.lng}`).join("|")
        );
      }
      url.searchParams.set("alternatives", "1");
      url.searchParams.set("language", "ja");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`route ${res.status}`);
      const data: RoutesResponse = await res.json();
      setRoutes(data.routes || []);
      if (
        !selectedRoute ||
        !data.routes.find((r) => r.type === selectedRoute)
      ) {
        setSelectedRoute("fastest");
      }

      // draw polylines
      const geom = (google.maps as any).geometry;
      const pathFast = data.routes.find((r) => r.type === "fastest")?.polyline;
      const pathEco = data.routes.find((r) => r.type === "eco")?.polyline;

      if (polyFastRef.current) polyFastRef.current.setMap(null as any);
      if (polyEcoRef.current) polyEcoRef.current.setMap(null as any);

      if (pathFast) {
        polyFastRef.current = new (google.maps as any).Polyline({
          path: geom.encoding.decodePath(pathFast),
          map,
          strokeColor: "#3b82f6", // blue
          strokeOpacity: 0.9,
          strokeWeight: 6,
        });
      }
      if (pathEco) {
        polyEcoRef.current = new (google.maps as any).Polyline({
          path: geom.encoding.decodePath(pathEco),
          map,
          strokeColor: "#22c55e", // green
          strokeOpacity: 0.9,
          strokeWeight: 5,
        });
      }
    } catch (e) {
      console.error(e);
      setError("ルートの取得に失敗しました。");
    } finally {
      setLoadingRoutes(false);
    }
  };

  // -----------------------------
  // Along-route spots
  // -----------------------------
  const alongMarkersRef = useRef<google.maps.Marker[]>([]);

  const clearAlongMarkers = () => {
    alongMarkersRef.current.forEach((m) => m.setMap(null as any));
    alongMarkersRef.current = [];
  };

  const fetchAlongSpots = async () => {
    const sr = routes.find((r) => r.type === (selectedRoute || "fastest"));
    if (!sr) {
      setError("先にルートを取得・選択してください。");
      return;
    }
    setLoadingAlong(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/api/v1/spots/along-route`);
      url.searchParams.set("polyline", sr.polyline);
      url.searchParams.set("buffer_m", String(BUFFER_M_DEFAULT));
      url.searchParams.set("user_id", String(USER_ID_DEFAULT));
      url.searchParams.set("followed_only", "1");
      url.searchParams.set("limit", "200");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`along-route ${res.status}`);
      const json = await res.json();
      const items: AlongSpot[] = Array.isArray(json) ? json : json.items ?? [];
      setAlongSpots(items);

      // draw markers
      clearAlongMarkers();
      const map = mapRef.current!;
      items.forEach((s) => {
        const m = new google.maps.Marker({
          map,
          position: { lat: s.lat, lng: s.lng },
          title: s.name,
          icon: {
            path: (google.maps as any).SymbolPath.CIRCLE,
            scale: 6,
            fillColor: s.is_special ? "#f59e0b" : "#8b5cf6", // amber / violet
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        m.addListener("click", () => {
          infoRef.current?.setContent(
            `<div style="min-width:220px">` +
              `<div style="font-weight:600;margin-bottom:4px">${s.name}</div>` +
              `<div style="font-size:12px;color:#444">${
                s.distance_m ? Math.round(s.distance_m) + "m" : ""
              }</div>` +
              `<button id="add-wp" style="margin-top:6px;padding:6px 10px;border-radius:8px;background:#111;color:#fff">経由地に追加</button>` +
              `</div>`
          );
          infoRef.current?.open({ map, anchor: m });
          // wire button after open
          setTimeout(() => {
            const btn = document.getElementById("add-wp");
            if (btn) btn.onclick = () => addWaypoint(s);
          }, 0);
        });
        alongMarkersRef.current.push(m);
      });
    } catch (e) {
      console.error(e);
      setError("沿線スポットの取得に失敗しました。");
    } finally {
      setLoadingAlong(false);
    }
  };

  const addWaypoint = (s: AlongSpot) => {
    setWaypoints((prev) => [...prev, { lat: s.lat, lng: s.lng }]);
  };

  // Recalculate routes whenever waypoints change (after initial)
  useEffect(() => {
    if (waypoints.length === 0) return;
    fetchRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints]);

  // -----------------------------
  // Playlist
  // -----------------------------
  const proposePlaylist = async () => {
    const sr = routes.find((r) => r.type === (selectedRoute || "fastest"));
    if (!sr) {
      setError("先にルートを選択してください。");
      return;
    }
    setLoadingPlaylist(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/api/v1/plans/content-priority`);
      url.searchParams.set("target_min", String(Math.round(sr.duration_min)));
      url.searchParams.set("user_id", String(USER_ID_DEFAULT));
      url.searchParams.set("langs", "ja");
      url.searchParams.set("tolerance_min", String(TOLERANCE_MIN_DEFAULT));
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`plan ${res.status}`);
      const json = await res.json();
      const queue: PlaylistItem[] = json?.queue ?? [];
      setPlaylist(queue);
    } catch (e) {
      console.error(e);
      setError("プレイリスト提案の取得に失敗しました。");
    } finally {
      setLoadingPlaylist(false);
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* ヘッダーを固定表示 */}
      <div className="fixed top-0 left-0 w-full z-10">
        <Header />
      </div>

      {/* ヘッダー分の余白を追加 */}
      <main className="scroll-smooth pt-32">
        {/* 検索バー */}
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="relative">
            <input
              placeholder="目的地を入力…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-60 overflow-auto z-20">
                {predictions.map((p) => (
                  <button
                    key={p.place_id}
                    onClick={() => selectPrediction(p)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* マップ */}
        <div className="max-w-md mx-auto px-4 mb-4">
          <div
            ref={mapDivRef}
            className="w-full h-80 rounded-xl shadow-card overflow-hidden"
          />
        </div>

        {/* ルート選択カード */}
        {routes.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex gap-3">
              {routes.map((r) => (
                <button
                  key={r.type}
                  onClick={() => setSelectedRoute(r.type)}
                  className={`flex-1 p-4 rounded-xl shadow-card border-2 transition-colors ${
                    selectedRoute === r.type
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="text-sm text-gray-600 mb-1">
                    {r.type === "fastest" ? "最短" : "エコ"}
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {toMinLabel(r.duration_min)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {r.distance_km.toFixed(1)} km
                  </div>
                  {r.advisory?.fuel_consumption_ml != null && (
                    <div className="text-xs text-gray-500 mt-1">
                      燃料: {Math.round(r.advisory.fuel_consumption_ml)} ml
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchRoutes}
              disabled={!destMarkerRef.current}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ルート取得
            </button>
            <button
              onClick={fetchAlongSpots}
              disabled={!routes.length}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              沿線スポット表示
            </button>
            <button
              onClick={proposePlaylist}
              disabled={!selectedRouteObj}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              プレイリスト提案
            </button>
          </div>
        </div>

        {/* 経由地チップ */}
        {waypoints.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex flex-wrap gap-2">
              {waypoints.map((w, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs"
                >
                  WP{i + 1}: {w.lat.toFixed(3)},{w.lng.toFixed(3)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 沿線スポットリスト */}
        {alongSpots.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              沿線のフォロー推しスポット ({alongSpots.length}件)
            </h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {alongSpots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <div>
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="text-sm text-gray-600">
                      {s.distance_m ? `${Math.round(s.distance_m)} m` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => addWaypoint(s)}
                    className="px-3 py-1 bg-gray-900 text-white rounded-lg text-xs"
                  >
                    経由地に追加
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* プレイリスト */}
        {playlist.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              プレイリスト提案
            </h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {playlist.map((p) => (
                <div
                  key={p.content_id}
                  className="p-3 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-900 flex-1">
                      {p.title || `コンテンツ #${p.content_id}`}
                    </div>
                    <div className="text-sm text-gray-600 ml-2">
                      {toMinLabel(p.duration_min)}
                    </div>
                  </div>
                  {p.lang && (
                    <div className="text-sm text-gray-600 mt-1">
                      言語: {p.lang}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ステータス表示 */}
        <div className="max-w-md mx-auto px-4 mb-6">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <div>
              {loadingRoutes && "ルート取得中…"}
              {error && <span className="text-red-600 ml-2">{error}</span>}
            </div>
            <div>{getEnvDisplay()}</div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <BottomNav />
    </div>
  );
}
