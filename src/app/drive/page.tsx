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
import { IoLocationSharp } from "react-icons/io5";
import { TbLocationFilled } from "react-icons/tb";
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
const DEFAULT_ZOOM = 11; // より広い範囲を表示するため縮小
const AUTOCOMPLETE_RADIUS_M = 3000;
const BUFFER_M_DEFAULT = 10000; // 一時的に10kmに拡大
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
  routeProgress?: number; // ルート進行度（0.0〜1.0）
  balancedScore?: number; // バランス距離スコア（0.0〜1.0）
}

interface PlaylistItem {
  content_id: number;
  title: string;
  duration_min: number | null;
  lang?: string;
  spot_id?: number;
  oshi_id?: number;
  related_oshis?: string[];
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

// 後で実装予定: ルートの進行度を計算する関数1
/*
function calculateRouteProgress(
  spot: { lat: number; lng: number },
  routePolyline: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  try {
    // Google Maps Geometry ライブラリを使用してpolylineをデコード
    const geom = (google.maps as any).geometry;
    if (!geom || !geom.encoding) {
      // フォールバック: 直線距離での概算
      return calculateLinearProgress(spot, origin, destination);
    }

    const path = geom.encoding.decodePath(routePolyline);
    if (!path || path.length < 2) {
      return calculateLinearProgress(spot, origin, destination);
    }

    // ルート上の各ポイントまでの累積距離を計算
    let totalDistance = 0;
    const segmentDistances: number[] = [];
    
    for (let i = 1; i < path.length; i++) {
      const segmentDistance = google.maps.geometry.spherical.computeDistanceBetween(
        path[i - 1],
        path[i]
      );
      totalDistance += segmentDistance;
      segmentDistances.push(totalDistance);
    }

    // スポットから最も近いルート上のポイントを見つける
    let minDistance = Infinity;
    let closestSegmentIndex = 0;
    
    for (let i = 0; i < path.length; i++) {
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(spot.lat, spot.lng),
        path[i]
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestSegmentIndex = i;
      }
    }

    // そのポイントまでの累積距離を計算
    let distanceToClosest = 0;
    for (let i = 0; i < closestSegmentIndex; i++) {
      if (i < segmentDistances.length) {
        distanceToClosest = segmentDistances[i];
      }
    }

    // 進行度を計算（0.0 〜 1.0）
    return totalDistance > 0 ? distanceToClosest / totalDistance : 0.5;
  } catch (error) {
    console.warn("ルート進行度計算でエラー:", error);
    return calculateLinearProgress(spot, origin, destination);
  }
}

// 後で実装予定: 直線距離での概算進行度計算（フォールバック）
function calculateLinearProgress(
  spot: { lat: number; lng: number },
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  try {
    const originToSpot = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(origin.lat, origin.lng),
      new google.maps.LatLng(spot.lat, spot.lng)
    );
    
    const originToDest = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(origin.lat, origin.lng),
      new google.maps.LatLng(destination.lat, destination.lng)
    );

    if (originToDest === 0) return 0.5;
    
    // 直線距離での概算進行度
    return Math.max(0, Math.min(1, originToSpot / originToDest));
  } catch (error) {
    console.warn("直線距離計算でエラー:", error);
    return 0.5;
  }
}

// 後で実装予定: スポットをルートの進行度に基づいてセクション分割し、均等に分布させる
function distributeSpotsEvenly(
  spots: any[],
  routePolyline: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  sections: number = 5
): any[] {
  if (spots.length === 0) return [];

  // 各スポットの進行度を計算
  const spotsWithProgress = spots.map(spot => ({
    ...spot,
    routeProgress: calculateRouteProgress(spot, routePolyline, origin, destination)
  }));

  // セクションごとにスポットを分類
  const sectionedSpots: any[][] = Array(sections).fill(null).map(() => []);
  
  spotsWithProgress.forEach(spot => {
    const sectionIndex = Math.min(
      Math.floor(spot.routeProgress * sections),
      sections - 1
    );
    sectionedSpots[sectionIndex].push(spot);
  });

  // 各セクション内で距離順にソート
  sectionedSpots.forEach(section => {
    section.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));
  });

  // 各セクションから均等に選択（最大件数を考慮）
  const maxPerSection = Math.ceil(200 / sections);
  const distributedSpots: any[] = [];
  
  sectionedSpots.forEach(section => {
    const selected = section.slice(0, maxPerSection);
    distributedSpots.push(...selected);
  });

  // 最終的に進行度順でソート
  return distributedSpots.sort((a, b) => a.routeProgress - b.routeProgress);
}

// 後で実装予定: バランスの良い距離スコアを計算
function calculateBalancedDistanceScore(
  spot: any,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  try {
    const distFromOrigin = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(origin.lat, origin.lng),
      new google.maps.LatLng(spot.lat, spot.lng)
    );
    
    const distToDestination = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(spot.lat, spot.lng),
      new google.maps.LatLng(destination.lat, destination.lng)
    );
    
    const totalRouteDistance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(origin.lat, origin.lng),
      new google.maps.LatLng(destination.lat, destination.lng)
    );

    if (totalRouteDistance === 0) return 0;

    // ルートの真ん中に近いほど高スコア
    const midPoint = totalRouteDistance / 2;
    const distanceFromMid = Math.abs((distFromOrigin + distToDestination) / 2 - midPoint);
    
    // スコアを正規化（0〜1、高いほど良い）
    return Math.max(0, 1 - (distanceFromMid / totalRouteDistance));
  } catch (error) {
    console.warn("バランス距離スコア計算でエラー:", error);
    return 0.5;
  }
}
*/

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
  const [searchSuggestions, setSearchSuggestions] = useState<
    Array<{
      place_id: string;
      name: string;
      address: string;
      location: { latitude: number; longitude: number };
    }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // 後で実装予定: スポットソート方法の選択
  // const [spotSortMethod, setSpotSortMethod] = useState<"default" | "progress" | "distributed" | "balanced">("default");

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

        // 地図初期化後に現在地マーカーを作成
        if (currentLocation) {
          createOriginMarker(currentLocation);
        }

        // Google Places Autocomplete は使用しない
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

  // 地図外をクリックした時に候補リストを非表示にする
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !target.closest("#search-input") &&
        !target.closest(".search-suggestions")
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // -----------------------------
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
        mapRef.current.setZoom(13); // より広い範囲を表示
      }

      // 現在地マーカーを作成
      createOriginMarker(coords);
    } catch (error) {
      console.error("位置情報の取得に失敗しました:", error);
      setError(
        "現在地の取得に失敗しました。位置情報の許可を確認してください。"
      );
    } finally {
      setLoadingLocation(false);
    }
  };

  // 現在地マーカーを作成する関数
  const createOriginMarker = (coords: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    // 既存の現在地マーカーを削除
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
    }

    // 新しい現在地マーカーを作成
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
  };

  // 場所選択の処理
  const handlePlaceSelection = (
    name: string,
    coords: { lat: number; lng: number },
    address?: string // 住所パラメータを追加
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
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#DC2626"/>
            <path d="M12 11.5c-1.12-2.5-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#DC2626"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 32),
      },
    });

    // 目的地マーカーにクリックイベントを追加
    destMarkerRef.current.addListener("click", () => {
      if (infoRef.current) {
        const content = `
          <div style="min-width: 200px; padding: 16px;">
            <button 
              id="go-here-btn"
              style="
                width: 100%;
                padding: 12px 16px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: background 0.2s;
                margin-bottom: 16px;
              "
              onmouseover="this.style.background='#2563eb'"
              onmouseout="this.style.background='#3b82f6'"
            >
              ここに行く
            </button>
            <div style="font-weight: 600; margin-bottom: 8px; color: #333; font-size: 14px;">
              ${name}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              ${address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
            </div>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button 
                id="set-origin-btn"
                style="
                  flex: 1;
                  padding: 8px 12px;
                  background: #f59e0b;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-weight: 500;
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#d97706'"
                onmouseout="this.style.background='#f59e0b'"
              >
                出発地に設定
              </button>
              <button 
                id="share-btn"
                style="
                  flex: 1;
                  padding: 8px 12px;
                  background: #10b981;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-weight: 500;
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#059669'"
                onmouseout="this.style.background='#10b981'"
              >
                共有
              </button>
            </div>
          </div>
        `;

        infoRef.current.setContent(content);
        infoRef.current.open(map, destMarkerRef.current);

        // ボタンクリックイベントを設定
        setTimeout(() => {
          const goHereBtn = document.getElementById("go-here-btn");
          const setOriginBtn = document.getElementById("set-origin-btn");
          const shareBtn = document.getElementById("share-btn");

          if (goHereBtn) {
            goHereBtn.addEventListener("click", () => {
              fetchRoutes();
              infoRef.current?.close();
            });
          }

          if (setOriginBtn) {
            setOriginBtn.addEventListener("click", () => {
              // 出発地として設定
              if (mapRef.current) {
                mapRef.current.setCenter(coords);
                mapRef.current.setZoom(13);
                createOriginMarker(coords);
                setCurrentLocation(coords);
                setCenter(coords);
              }
              infoRef.current?.close();
            });
          }

          if (shareBtn) {
            shareBtn.addEventListener("click", () => {
              // 共有機能（クリップボードにコピー）
              const shareText = `${name}\n${
                address || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
              }`;
              navigator.clipboard
                .writeText(shareText)
                .then(() => {
                  // 成功メッセージを表示（簡易的な実装）
                  alert("場所の情報をクリップボードにコピーしました");
                })
                .catch(() => {
                  alert("クリップボードへのコピーに失敗しました");
                });
            });
          }
        }, 100);
      }
    });

    // 地図の中心を目的地に設定
    map.setCenter(coords);
    map.setZoom(13); // より広い範囲を表示

    // 既存のルートと関連データをクリア
    setRoutes([]);
    setSelectedRoute(null);
    setWaypoints([]);
    setAlongSpots([]);
    setPlaylist([]);

    // 既存のポリラインをクリア
    if (polyFastRef.current) {
      polyFastRef.current.setMap(null as any);
      polyFastRef.current = null;
    }
    if (polyEcoRef.current) {
      polyEcoRef.current.setMap(null as any);
      polyEcoRef.current = null;
    }

    // 検索クエリをクリア
    setQuery("");
  };

  // 検索処理
  const handleSearch = async () => {
    const searchQuery = query.trim();
    if (!searchQuery) return;

    // 検索実行時に候補リストを非表示
    setShowSuggestions(false);
    setSearchSuggestions([]);

    setError(null);
    setLoadingRoutes(true);

    try {
      // Google Maps Places API (search-text)を使用して検索
      const url = new URL(`${API_BASE}/bff/maps/search-text`);
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("language", "ja");
      url.searchParams.set("region", "JP");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`search-text ${res.status}`);

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        const firstResult = data.items[0];
        const coords = {
          lat: firstResult.location.latitude,
          lng: firstResult.location.longitude,
        };

        // 検索結果を表示してピンを立てる
        handlePlaceSelection(
          firstResult.address || firstResult.name || searchQuery,
          coords,
          firstResult.address
        );
      } else {
        setError(
          "検索結果が見つかりませんでした。別のキーワードをお試しください。"
        );
      }
    } catch (error) {
      console.error("検索エラー:", error);
      setError("検索に失敗しました。しばらく時間をおいて再度お試しください。");
    } finally {
      setLoadingRoutes(false);
    }
  };

  // 入力に応じて候補を検索
  const fetchSearchSuggestions = async (input: string) => {
    if (input.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const url = new URL(`${API_BASE}/bff/maps/search-text`);
      url.searchParams.set("q", input);
      url.searchParams.set("language", "ja");
      url.searchParams.set("region", "JP");
      url.searchParams.set("limit", "5");

      const res = await fetch(url.toString());
      if (!res.ok) return;

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setSearchSuggestions(data.items);
        setShowSuggestions(true);
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("候補検索エラー:", error);
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 候補選択の処理
  const handleSuggestionSelect = (suggestion: {
    place_id: string;
    name: string;
    address: string;
    location: { latitude: number; longitude: number };
  }) => {
    try {
      console.log("候補が選択されました:", suggestion); // デバッグログを追加

      const coords = {
        lat: suggestion.location.latitude,
        lng: suggestion.location.longitude,
      };

      console.log("座標:", coords); // 座標の確認

      // 検索結果を表示してピンを立てる
      handlePlaceSelection(
        suggestion.address || suggestion.name,
        coords,
        suggestion.address
      );

      // 候補を非表示にしてクエリをクリア
      setShowSuggestions(false);
      setSearchSuggestions([]);
      setQuery("");

      console.log("候補選択処理が完了しました"); // 処理完了の確認
    } catch (error) {
      console.error("候補選択処理でエラーが発生しました:", error);
      setError("候補の選択に失敗しました。再度お試しください。");
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

      // デバッグ: is_specialの値を確認
      console.log(
        "Drive沿線スポットデータ:",
        items.map((s) => ({
          id: s.id,
          name: s.name,
          is_special: s.is_special,
          type: typeof s.is_special,
          value: s.is_special,
        }))
      );

      // 後で実装予定: 選択されたソート方法に基づいてスポットをソート
      /*
      let sortedItems = [...items];
      
      if (spotSortMethod !== "default" && mapRef.current) {
        try {
          const origin = originMarkerRef.current?.getPosition() || mapRef.current.getCenter();
          const destination = destMarkerRef.current?.getPosition();
          
          if (origin && destination) {
            const originCoords = {
              lat: origin.lat(),
              lng: origin.lng()
            };
            const destCoords = {
              lat: destination.lat(),
              lng: destination.lng()
            };
            
            switch (spotSortMethod) {
              case "progress":
                // 進行度順でソート
                sortedItems = items.map(spot => ({
                  ...spot,
                  routeProgress: calculateRouteProgress(spot, sr.polyline, originCoords, destCoords)
                })).sort((a, b) => (a.routeProgress || 0) - (b.routeProgress || 0));
                break;
                
              case "distributed":
                // 均等分布でソート
                sortedItems = distributeSpotsEvenly(items, sr.polyline, originCoords, destCoords, 5);
                break;
                
              case "balanced":
                // バランス距離スコアでソート
                sortedItems = items.map(spot => ({
                  ...spot,
                  balancedScore: calculateBalancedDistanceScore(spot, originCoords, destCoords)
                })).sort((a, b) => (b.balancedScore || 0) - (a.balancedScore || 0));
                break;
            }
          }
        } catch (error) {
          console.warn("スポットソート処理でエラー:", error);
          // エラーが発生した場合は元の順序を使用
          sortedItems = items;
        }
      }
      */

      setAlongSpots(items);

      // draw markers
      clearAlongMarkers();
      const map = mapRef.current!;
      items.forEach((s) => {
        // is_specialが真値のスポットにはHondaLogo.svgを使用
        let icon = undefined;
        if (Boolean(s.is_special)) {
          icon = {
            url: "/HondaLogo.svg",
            scaledSize: new google.maps.Size(26, 24),
            anchor: new google.maps.Point(16, 16),
          };
        } else {
          // 通常のスポットはstar_logo.svg
          icon = {
            url: "/star_logo.svg",
            scaledSize: new google.maps.Size(26, 24),
            anchor: new google.maps.Point(16, 16),
          };
        }

        const m = new google.maps.Marker({
          map,
          position: { lat: s.lat, lng: s.lng },
          title: s.name,
          icon: icon,
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

  // 後で実装予定: ソート方法が変更された時にスポットを再取得
  /*
  useEffect(() => {
    if (alongSpots.length > 0 && spotSortMethod !== "default") {
      fetchAlongSpots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotSortMethod]);
  */

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
      const url = new URL(`${API_BASE}/api/v1/planner/playlist`);

      const requestBody = {
        target_duration_min: Math.round(sr.duration_min),
        user_id: USER_ID_DEFAULT,
        preferred_langs: ["ja"],
        tolerance_min: TOLERANCE_MIN_DEFAULT,
        content_types: ["youtube"],
        max_items: 20,
      };

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error(`planner ${res.status}`);
      const json = await res.json();

      // 新しいレスポンス形式に対応
      const playlistData = json?.playlist ?? [];
      const summary = json?.summary;

      // 既存のPlaylistItem形式に変換
      const queue: PlaylistItem[] = playlistData.map((item: any) => ({
        content_id: item.content_id,
        title: item.title,
        duration_min: item.duration_min,
        lang: item.lang,
        spot_id: undefined,
        oshi_id: undefined,
        related_oshis: item.related_oshis || [],
      }));

      setPlaylist(queue);

      // サマリー情報をログ出力（デバッグ用）
      if (summary) {
        console.log("プレイリスト生成サマリー:", summary);
      }
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
      <div className="fixed top-0 left-0 w-full z-[9999]">
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    fetchSearchSuggestions(e.target.value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {showSuggestions && (
                  <div className="absolute z-40 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto search-suggestions">
                    {searchSuggestions.length > 0 && (
                      <div className="p-2 bg-gray-100 text-xs text-gray-600 border-b border-gray-200">
                        候補: {searchSuggestions.length}件
                      </div>
                    )}
                    {searchSuggestions.map((s, index) => (
                      <div
                        key={s.place_id}
                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                          index < searchSuggestions.length - 1
                            ? "border-b border-gray-200"
                            : ""
                        }`}
                        onClick={() => handleSuggestionSelect(s)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <div className="font-medium text-gray-900 mb-1">
                          {s.name}
                        </div>
                        <div className="text-sm text-gray-600">{s.address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  // 検索ボタンクリック時にも候補リストを非表示
                  setShowSuggestions(false);
                  setSearchSuggestions([]);
                  handleSearch();
                }}
                disabled={!query.trim() || loadingRoutes}
                className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                title="検索"
              >
                検索
              </button>
            </div>
          </div>
        </div>

        {/* マップ */}
        <div className="max-w-md mx-auto px-4 mb-4">
          <div className="relative">
            <div
              ref={mapDivRef}
              className="w-full h-80 rounded-xl shadow-card overflow-hidden"
            />

            {/* 現在地ボタン（右下） */}
            <div
              className="absolute z-20"
              style={{
                bottom: 70,
                right: 10,
              }}
            >
              <button
                onClick={() => {
                  if (!navigator.geolocation || !mapRef.current) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = pos.coords.latitude;
                      const lng = pos.coords.longitude;
                      const coords = { lat, lng };

                      // 地図の中心を現在地に移動
                      mapRef.current.setCenter(coords);
                      mapRef.current.setZoom(13);

                      // 現在地マーカーを作成・表示
                      createOriginMarker(coords);
                      setCurrentLocation(coords);
                      setCenter(coords);
                    },
                    () => setError("現在地が取得できませんでした"),
                    { enableHighAccuracy: true, timeout: 5000 }
                  );
                }}
                style={{
                  width: "40px",
                  height: "40px",
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ddd",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(4, 131, 250, 0.15)",
                }}
                title="現在地へ移動"
              >
                <TbLocationFilled size={18} color="#4285F4" />
              </button>
            </div>
          </div>
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
                    className={`flex-1 p-0 rounded-xl shadow-card border-2 transition-colors ${
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
        {routes.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex flex-wrap gap-2 justify-center">
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
              <button
                onClick={() => alert("後日実装予定")}
                disabled={!selectedRouteObj}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
              >
                出発
              </button>
            </div>

            {/* スポットソート方法選択 */}
            {alongSpots.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  スポット表示順序:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => false}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      false
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    デフォルト
                  </button>
                  <button
                    onClick={() => false}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      false
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    進行度順
                  </button>
                  <button
                    onClick={() => false}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      false
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    均等分布
                  </button>
                  <button
                    onClick={() => false}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      false
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    バランス重視
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {false && "APIのデフォルト順序"}
                  {false && "出発地から目的地への進行度順"}
                  {false && "ルート全体に均等に分布"}
                  {false && "出発地と目的地の距離バランス重視"}
                </div>
              </div>
            )}
          </div>
        )}

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
              {false && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  - {false ? "進行度順" : false ? "均等分布" : "バランス重視"}
                </span>
              )}
            </h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {alongSpots.map((s, index) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      {s.distance_m && (
                        <span>距離: {Math.round(s.distance_m)}m</span>
                      )}
                      {/* 後で実装予定: ソート方法に応じた情報表示
              {spotSortMethod === "progress" && s.routeProgress !== undefined && (
                <span className="text-blue-600">
                  進行度: {Math.round(s.routeProgress * 100)}%
                </span>
              )}
              {spotSortMethod === "balanced" && s.balancedScore !== undefined && (
                <span className="text-green-600">
                  バランス: {Math.round(s.balancedScore * 100)}%
                </span>
              )}
              {spotSortMethod === "distributed" && s.routeProgress !== undefined && (
                <span className="text-purple-600">
                  進行度: {Math.round(s.routeProgress * 100)}%
                </span>
              )}
              */}
                    </div>
                  </div>
                  <button
                    onClick={() => addWaypoint(s)}
                    className="px-3 py-1 bg-gray-900 text-white rounded-lg text-xs ml-2"
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
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-2xl">🎵</span>
              <span className="text-black-600">おすすめプレイリスト</span>
            </h3>

            {/* プレイリスト全体像カード */}
            <div className="p-4 bg-white rounded-xl shadow-lg border border-green-200 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* <span className="text-2xl">🎵</span>
                  <span className="font-semibold text-gray-900">
                    ドライブ用プレイリスト
                  </span> */}
                </div>
                {/* <div className="text-sm text-green-600 font-medium">
                  {playlist.length}件
                </div> */}
              </div>

              {/* 推し名表示 */}
              <div className="mb-3">
                <div className="text-base font-bold text-gray-600 mb-2">
                  ☆推し
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // プレイリスト内のコンテンツから推し名を抽出
                    const allOshis = new Set<string>();
                    playlist.forEach((item) => {
                      if (item.related_oshis) {
                        item.related_oshis.forEach((oshi) =>
                          allOshis.add(oshi)
                        );
                      }
                    });

                    const oshiList = Array.from(allOshis);

                    if (oshiList.length > 0) {
                      return oshiList.slice(0, 5).map((oshi, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                        >
                          {oshi}
                        </span>
                      ));
                    } else {
                      return (
                        <span className="text-sm text-gray-500 italic">
                          推し情報がありません
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* 時間とコンテンツ数 */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-600">
                  合計時間:{" "}
                  <span className="font-semibold text-gray-900">
                    {playlist.reduce(
                      (sum, p) => sum + (p.duration_min || 0),
                      0
                    )}
                    分
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  コンテンツ:{" "}
                  <span className="font-semibold text-gray-900">
                    {playlist.length}件
                  </span>
                </div>
              </div>

              {/* リストを見るボタン */}
              <button
                onClick={() => setShowPlaylistModal(true)}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>📋</span>
                リストを見る
              </button>
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
 
          </div>
        </div>
      </main>

      {/* プレイリスト詳細モーダル */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">🎵</span>
                プレイリスト詳細
              </h3>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-4 max-h-[60vh] overflow-auto">
              <div className="space-y-3">
                {playlist.map((p, index) => (
                  <div
                    key={p.content_id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-500 font-mono">
                            #{index + 1}
                          </span>
                          <span className="font-medium text-gray-900">
                            {p.title || `コンテンツ #${p.content_id}`}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          時間: {toMinLabel(p.duration_min)}
                          {p.lang && (
                            <span className="ml-3">言語: {p.lang}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                <span>
                  合計時間:{" "}
                  {playlist.reduce((sum, p) => sum + (p.duration_min || 0), 0)}
                  分
                </span>
                <span>コンテンツ数: {playlist.length}件</span>
              </div>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <BottomNav />
    </div>
  );
}
