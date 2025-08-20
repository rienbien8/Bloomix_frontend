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
import { LocationIcon } from "../../components/Icons";

// =============================
// Config
// =============================
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_CENTER = { lat: 35.6809591, lng: 139.7673068 }; // 東京駅
const DEFAULT_ZOOM = 13;
const AUTOCOMPLETE_RADIUS_M = 3000;
const BUFFER_M_DEFAULT = 10000; // 一時的に5kmに拡大してテスト
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

interface SearchHistory {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
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
  const autocompleteRef = useRef<any | null>(null);

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [query, setQuery] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<"fastest" | "eco" | null>(
    null
  );
  const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>(
    []
  );

  const [alongSpots, setAlongSpots] = useState<AlongSpot[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);

  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingAlong, setLoadingAlong] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRouteObj = routes.find((r) => r.type === selectedRoute) || null;

  // -----------------------------
  // Update route line colors based on selection
  // -----------------------------
  const updateRouteLineColors = () => {
    // 各ラインが存在する場合のみ更新
    if (polyFastRef.current) {
      const isSelected = selectedRoute === "fastest";
      polyFastRef.current.setOptions({
        strokeColor: isSelected ? "#3b82f6" : "#9ca3af", // blue or gray
        strokeOpacity: isSelected ? 0.9 : 0.4,
        strokeWeight: isSelected ? 6 : 4,
      });
    }
    if (polyEcoRef.current) {
      const isSelected = selectedRoute === "eco";
      polyEcoRef.current.setOptions({
        strokeColor: isSelected ? "#22c55e" : "#9ca3af", // green or gray
        strokeOpacity: isSelected ? 0.9 : 0.4,
        strokeWeight: isSelected ? 5 : 3,
      });
    }
  };

  // selectedRouteが変更された時にラインの色を更新
  useEffect(() => {
    updateRouteLineColors();
  }, [selectedRoute]);

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

        // 現在地を取得
        await getCurrentLocation();

        if (!mapDivRef.current) return;
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center: center,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        infoRef.current = new google.maps.InfoWindow();

        // Google Places Autocomplete を初期化
        if (
          typeof google !== "undefined" &&
          google.maps &&
          google.maps.places
        ) {
          const input = document.getElementById(
            "search-input"
          ) as HTMLInputElement;
          if (input) {
            autocompleteRef.current = new google.maps.places.Autocomplete(
              input,
              {
                types: ["establishment", "geocode"],
                componentRestrictions: { country: "jp" },
              }
            );

            autocompleteRef.current.addListener("place_changed", () => {
              const place = autocompleteRef.current.getPlace();
              if (place.geometry && place.geometry.location) {
                const coords = {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                };
                handlePlaceSelection(place.name || "選択された場所", coords);
              }
            });
          }
        }
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

  // 現在地を取得
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("お使いのブラウザは位置情報をサポートしていません。");
      return;
    }

    setLoadingLocation(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        }
      );

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setCurrentLocation(coords);
      setCenter(coords);

      // 地図が初期化済みの場合は中心を更新
      if (mapRef.current) {
        mapRef.current.setCenter(coords);
        mapRef.current.setZoom(15);
      }

      // 現在地マーカーを作成
      if (originMarkerRef.current) {
        originMarkerRef.current.setMap(null);
      }

      originMarkerRef.current = new google.maps.Marker({
        position: coords,
        map: mapRef.current,
        title: "現在地",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    } catch (error) {
      console.error("位置情報の取得に失敗しました:", error);
      setError(
        "現在地の取得に失敗しました。位置情報の許可を確認してください。"
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  // 場所選択の処理
  const handlePlaceSelection = (
    name: string,
    coords: { lat: number; lng: number }
  ) => {
    setError(null);

    const map = mapRef.current;
    if (!map) return;

    // 目的地マーカーを作成
    if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null);
    }

    destMarkerRef.current = new google.maps.Marker({
      map,
      position: coords,
      title: name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#EA4335",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });

    // 地図の中心を目的地に設定
    map.setCenter(coords);
    map.setZoom(15);

    // 検索クエリをクリア
    setQuery("");
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

    // 出発地の決定（優先順位：現在地マーカー > 地図中心）
    let originPos: google.maps.LatLng;
    if (originMarkerRef.current) {
      originPos = originMarkerRef.current.getPosition()!;
    } else {
      // 現在地マーカーがない場合は地図中心を使用
      originPos = map.getCenter()!;
      setError(
        "現在地が取得できませんでした。地図の中心を出発地として使用します。"
      );
    }

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
          strokeColor: selectedRoute === "fastest" ? "#3b82f6" : "#9ca3af", // blue or gray
          strokeOpacity: selectedRoute === "fastest" ? 0.9 : 0.4,
          strokeWeight: selectedRoute === "fastest" ? 6 : 4,
          clickable: true, // クリック可能にする
        });

        // クリックイベントリスナーを追加
        polyFastRef.current.addListener("click", () => {
          setSelectedRoute("fastest");
        });

        // ホバー効果を追加
        polyFastRef.current.addListener("mouseover", () => {
          if (selectedRoute !== "fastest") {
            polyFastRef.current.setOptions({
              strokeColor: "#3b82f6",
              strokeOpacity: 0.7,
              strokeWeight: 7,
            });
          }
        });

        polyFastRef.current.addListener("mouseout", () => {
          updateRouteLineColors();
        });
      }
      if (pathEco) {
        polyEcoRef.current = new (google.maps as any).Polyline({
          path: geom.encoding.decodePath(pathEco),
          map,
          strokeColor: selectedRoute === "eco" ? "#22c55e" : "#9ca3af", // green or gray
          strokeOpacity: selectedRoute === "eco" ? 0.9 : 0.4,
          strokeWeight: selectedRoute === "eco" ? 5 : 3,
          clickable: true, // クリック可能にする
        });

        // クリックイベントリスナーを追加
        polyEcoRef.current.addListener("click", () => {
          setSelectedRoute("eco");
        });

        // ホバー効果を追加
        polyEcoRef.current.addListener("mouseover", () => {
          if (selectedRoute !== "eco") {
            polyEcoRef.current.setOptions({
              strokeColor: "#22c55e",
              strokeOpacity: 0.7,
              strokeWeight: 6,
            });
          }
        });

        polyEcoRef.current.addListener("mouseout", () => {
          updateRouteLineColors();
        });
      }

      // ライン作成後に色を更新
      setTimeout(() => {
        updateRouteLineColors();
      }, 100);
    } catch (e) {
      console.error(e);
      setError("ルートの取得に失敗しました。");
    } finally {
      setLoadingRoutes(false);
    }
  };

  // 地図上でクリックして出発地を設定
  const setOriginFromMapClick = () => {
    if (!mapRef.current) return;

    // 地図クリックイベントを一時的に有効化
    const map = mapRef.current;
    const clickListener = map.addListener(
      "click",
      (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          const coords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          // 既存の出発地マーカーを削除
          if (originMarkerRef.current) {
            originMarkerRef.current.setMap(null);
          }

          // 新しい出発地マーカーを作成
          originMarkerRef.current = new google.maps.Marker({
            position: coords,
            map,
            title: "出発地",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#4285F4",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          // 現在地を更新
          setCurrentLocation(coords);

          // クリックイベントを削除
          google.maps.event.removeListener(clickListener);

          setError("出発地を設定しました。");
        }
      }
    );

    setError("地図上をクリックして出発地を設定してください。");
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
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  id="search-input"
                  placeholder="目的地を入力…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={getCurrentLocation}
                disabled={loadingLocation}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                title="現在地を取得"
              >
                <LocationIcon className="w-5 h-5" />
              </button>
            </div>
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
              {(() => {
                const fastestRoute = routes.find((r) => r.type === "fastest");
                const ecoRoute = routes.find((r) => r.type === "eco");
                const displayRoutes = [];

                if (fastestRoute) displayRoutes.push(fastestRoute);
                if (ecoRoute) displayRoutes.push(ecoRoute);

                return displayRoutes.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => setSelectedRoute(r.type)}
                    className={`flex-1 p-4 rounded-xl shadow-card border-2 transition-colors ${
                      selectedRoute === r.type
                        ? r.type === "fastest"
                          ? "border-blue-500 bg-blue-50"
                          : "border-green-500 bg-green-50"
                        : "border-gray-300 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="text-sm text-gray-600 mb-1">
                      {r.type === "fastest"
                        ? "時間を優先する"
                        : "コンテンツを楽しむ"}
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
                ));
              })()}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={setOriginFromMapClick}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
              title="地図上をクリックして出発地を設定"
            >
              出発地設定
            </button>
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
              {loadingLocation && "現在地取得中…"}
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
