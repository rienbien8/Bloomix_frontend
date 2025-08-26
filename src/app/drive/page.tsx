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
import {
  TbLocationFilled,
  TbMapPin,
  TbMusic,
  TbNavigation,
} from "react-icons/tb";
import { CiCirclePlus } from "react-icons/ci";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { LocationIcon } from "../../components/Icons";
import RewardPopup from "../../components/RewardPopup";

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

interface SearchResult {
  place_id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
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
  const minutes = Math.round(min);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}時間`;
    } else {
      return `${hours}時間${remainingMinutes}分`;
    }
  }
  return `${minutes}分`;
}

function getEnvDisplay() {
  const base = API_BASE;
  const hasKey = MAPS_API_KEY ? "●" : "×";
  return `API_BASE=${base} / MAPS_KEY=${hasKey}`;
}

// ルートの進行度を計算する関数
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
      const segmentDistance =
        google.maps.geometry.spherical.computeDistanceBetween(
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
  const spotsWithProgress = spots.map((spot) => ({
    ...spot,
    routeProgress: calculateRouteProgress(
      spot,
      routePolyline,
      origin,
      destination
    ),
  }));

  // セクションごとにスポットを分類
  const sectionedSpots: any[][] = Array(sections)
    .fill(null)
    .map(() => []);

  spotsWithProgress.forEach((spot) => {
    const sectionIndex = Math.min(
      Math.floor(spot.routeProgress * sections),
      sections - 1
    );
    sectionedSpots[sectionIndex].push(spot);
  });

  // 各セクション内で距離順にソート
  sectionedSpots.forEach((section) => {
    section.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));
  });

  // 各セクションから均等に選択（30件に制限）
  const maxPerSection = Math.ceil(30 / sections);
  const distributedSpots: any[] = [];

  sectionedSpots.forEach((section) => {
    const selected = section.slice(0, maxPerSection);
    distributedSpots.push(...selected);
  });

  // 30件に制限（進行度順でソート済み）
  const limitedSpots = distributedSpots.slice(0, 30);

  console.log(
    `セクション分割結果: ${sections}セクション、各セクション最大${maxPerSection}件`
  );
  console.log(`最終選択スポット数: ${limitedSpots.length}件`);

  return limitedSpots;
}

// 後で実装予定: バランスの良い距離スコアを計算
function calculateBalancedDistanceScore(
  spot: any,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  try {
    const distFromOrigin =
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin.lat, origin.lng),
        new google.maps.LatLng(spot.lat, spot.lng)
      );

    const distToDestination =
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(spot.lat, spot.lng),
        new google.maps.LatLng(destination.lat, destination.lng)
      );

    const totalRouteDistance =
      google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin.lat, origin.lng),
        new google.maps.LatLng(destination.lat, destination.lng)
      );

    if (totalRouteDistance === 0) return 0;

    // ルートの真ん中に近いほど高スコア
    const midPoint = totalRouteDistance / 2;
    const distanceFromMid = Math.abs(
      (distFromOrigin + distToDestination) / 2 - midPoint
    );

    // スコアを正規化（0〜1、高いほど良い）
    return Math.max(0, 1 - distanceFromMid / totalRouteDistance);
  } catch (error) {
    console.warn("バランス距離スコア計算でエラー:", error);
    return 0.5;
  }
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

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchResultMarkers, setSearchResultMarkers] = useState<
    google.maps.Marker[]
  >([]);

  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<"fastest" | "eco" | null>(
    null
  );
  const [waypoints, setWaypoints] = useState<
    { lat: number; lng: number; name: string }[]
  >([]);

  const [alongSpots, setAlongSpots] = useState<AlongSpot[]>([]);
  const [alongSpotsWithOshis, setAlongSpotsWithOshis] = useState<
    Array<AlongSpot & { oshiNames?: string[] }>
  >([]);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);

  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingAlong, setLoadingAlong] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [showPlaylistConfirmPopup, setShowPlaylistConfirmPopup] =
    useState(false);
  const [showSpotsModal, setShowSpotsModal] = useState(false);

  // 後で実装予定: スポットソート方法の選択
  // const [spotSortMethod, setSpotSortMethod] = useState<"default" | "progress" | "distributed" | "balanced">("default");

  const selectedRouteObj = routes.find((r) => r.type === selectedRoute) || null;

  // 検索結果のピンをクリアする関数
  const clearSearchResultMarkers = () => {
    console.log(
      "🔍 clearSearchResultMarkers 呼び出し - 現在のマーカー数:",
      searchResultMarkers.length
    );
    searchResultMarkers.forEach((marker) => {
      console.log("🗑️ マーカーを削除:", marker);
      marker.setMap(null);
    });
    setSearchResultMarkers([]);
    console.log("✅ 検索結果マーカーをクリア完了");
  };

  // 検索結果のピンを作成する関数
  const createSearchResultMarkers = (results: SearchResult[]) => {
    console.log("🔍 createSearchResultMarkers 開始 - 結果数:", results.length);
    clearSearchResultMarkers();

    if (!mapRef.current) return;

    const markers: google.maps.Marker[] = [];

    results.forEach((result, index) => {
      const coords = {
        lat: result.location.latitude,
        lng: result.location.longitude,
      };

      // 候補番号付きのピンを作成
      const marker = new google.maps.Marker({
        position: coords,
        map: mapRef.current,
        title: `${index + 1}. ${result.name}`,
        label: {
          text: String(index + 1),
          color: "white",
          fontWeight: "bold",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#f59e0b", // オレンジ色
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      // クリックイベントを追加
      marker.addListener("click", () => {
        // InfoWindowで場所情報を表示
        if (infoRef.current && mapRef.current) {
          const content = `
            <div style="min-width: 250px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; color: #333; font-size: 16px; margin-bottom: 6px;">
                  ${result.name}
                </div>
              </div>
              <button 
                id="set-destination-btn"
                style="
                  width: 100%;
                  padding: 10px 16px;
                  background: #38BDF8;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-weight: 500;
                  font-size: 14px;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#0EA5E9'"
                onmouseout="this.style.background='#38BDF8'"
              >
                目的地に設定
              </button>
            </div>
          `;

          infoRef.current.setContent(content);
          infoRef.current.open(mapRef.current, marker);

          // 目的地に設定ボタンのクリックイベントを設定
          setTimeout(() => {
            const setDestinationBtn = document.getElementById(
              "set-destination-btn"
            );
            if (setDestinationBtn) {
              setDestinationBtn.addEventListener("click", () => {
                // 目的地を設定
                handlePlaceSelection(result.name, coords, result.address);

                // 現在地から出発してルートを表示
                if (currentLocation) {
                  setCenter(currentLocation);
                  createOriginMarker(currentLocation);
                  // 検索結果のマーカーをクリア
                  clearSearchResultMarkers();
                  setSearchResults([]);
                  // ルートを取得
                  fetchRoutes();
                } else {
                  setError(
                    "現在地が取得できません。現在地の取得をお待ちください。"
                  );
                }
                // 情報ウィンドウを閉じる
                infoRef.current?.close();
              });
            }
          }, 100);
        }
      });

      markers.push(marker);
    });

    console.log("🔍 作成されたマーカー数:", markers.length);
    setSearchResultMarkers(markers);
    console.log("✅ 検索結果マーカーの設定完了");
  };

  // -----------------------------
  // Update route line colors based on selection
  // -----------------------------
  const updateRouteLineColors = () => {
    console.log("updateRouteLineColors called, selectedRoute:", selectedRoute); // デバッグログ
    console.log("polyFastRef.current exists:", !!polyFastRef.current); // デバッグログ
    console.log("polyEcoRef.current exists:", !!polyEcoRef.current); // デバッグログ

    // 最速ルートは一時的に非表示（後で復活予定）
    if (false && polyFastRef.current) {
      const isSelected = selectedRoute === "fastest";
      console.log(
        "Updating fastest route color:",
        isSelected ? "selected" : "unselected"
      ); // デバッグログ
      polyFastRef.current.setOptions({
        strokeColor: isSelected ? "#3b82f6" : "#9ca3af", // blue or gray
        strokeOpacity: isSelected ? 0.9 : 0.4,
        strokeWeight: isSelected ? 6 : 4,
      });
    }

    // エコルートのみを処理
    if (polyEcoRef.current) {
      const isSelected = selectedRoute === "eco";
      console.log(
        "Updating eco route color:",
        isSelected ? "selected" : "unselected"
      ); // デバッグログ
      polyEcoRef.current.setOptions({
        strokeColor: "#ec4899", // エコルートの色（ピンク）
        strokeOpacity: 0.8,
        strokeWeight: 5,
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

        // 地図クリックでInfoWindowを閉じる
        mapRef.current.addListener("click", () => {
          if (infoRef.current) {
            infoRef.current.close();
          }
        });

        // 地図初期化完了後に現在地を取得・マーカーを作成
        setTimeout(() => {
          if (currentLocation) {
            createOriginMarker(currentLocation);
          } else {
            getCurrentLocation();
          }
        }, 100);

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

  // URLクエリパラメータからスポット情報を取得して目的地を設定
  useEffect(() => {
    // 地図の初期化が完了するまで待機
    const checkMapAndProcessQuery = () => {
      if (!mapRef.current) {
        // 地図がまだ初期化されていない場合は少し待ってから再試行
        setTimeout(checkMapAndProcessQuery, 100);
        return;
      }

      console.log("🗺️ 地図初期化完了、クエリパラメータをチェック中...");

      // URLSearchParamsを使用してクエリパラメータを取得
      const urlParams = new URLSearchParams(window.location.search);
      const lat = urlParams.get("lat");
      const lng = urlParams.get("lng");
      const name = urlParams.get("name");
      const address = urlParams.get("address");

      console.log("🔍 クエリパラメータ:", { lat, lng, name, address });

      if (lat && lng && name) {
        const coords = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        };

        console.log("🎯 目的地を設定中:", { name, coords, address });

        // 目的地を設定
        handlePlaceSelection(name, coords, address || undefined, true);

        // クエリパラメータをクリア（ブラウザの履歴に残らないように）
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);

        console.log("✅ 目的地設定完了");
      } else {
        console.log("ℹ️ クエリパラメータなし");
      }
    };

    // 地図の初期化完了を待ってからクエリパラメータを処理
    checkMapAndProcessQuery();
  }, []); // 空の依存配列で、コンポーネントマウント時に1回だけ実行

  // ページ表示時に現在地を取得
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // 現在地が取得された後にクエリパラメータを再チェック
  useEffect(() => {
    if (!currentLocation || !mapRef.current) return;

    // URLSearchParamsを使用してクエリパラメータを取得
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get("lat");
    const lng = urlParams.get("lng");
    const name = urlParams.get("name");
    const address = urlParams.get("address");

    if (lat && lng && name) {
      console.log("🔄 現在地取得後、クエリパラメータを再処理:", {
        lat,
        lng,
        name,
      });

      const coords = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };

      // 目的地を設定
      handlePlaceSelection(name, coords, address || undefined, true);

      // クエリパラメータをクリア
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // 現在地が取得されたので、自動的にルート案内を開始
      console.log("🚀 現在地取得完了、自動的にルート案内を開始");
      setTimeout(() => {
        setCenter(currentLocation);
        createOriginMarker(currentLocation);
        // ルートを取得
        fetchRoutes();
      }, 1000); // 目的地設定の処理が完了するまで少し待機
    }
  }, [currentLocation]);

  // 地図外をクリックした時に候補リストを非表示にする
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // -----------------------------
  // 現在地を取得
  const getCurrentLocation = async () => {
    console.log("📍 現在地取得開始");

    if (!navigator.geolocation) {
      setError(
        "お使いのブラウザは位置情報をサポートしていません。東京駅を現在地として設定します。"
      );
      // 東京駅の座標を設定
      const tokyoStationCoords = { lat: 35.6812362, lng: 139.7671248 };
      setCurrentLocation(tokyoStationCoords);
      setCenter(tokyoStationCoords);
      console.log("📍 東京駅を現在地として設定:", tokyoStationCoords);

      // 地図が初期化済みの場合は中心を更新とマーカー作成
      if (mapRef.current) {
        mapRef.current.setCenter(tokyoStationCoords);
        mapRef.current.setZoom(13);
        createOriginMarker(tokyoStationCoords);
      }
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

      console.log("📍 現在地取得成功:", coords);
      setCurrentLocation(coords);
      setCenter(coords);

      // 地図が初期化済みの場合は中心を更新とマーカー作成
      if (mapRef.current) {
        mapRef.current.setCenter(coords);
        mapRef.current.setZoom(13); // より広い範囲を表示
        // 現在地マーカーを作成
        createOriginMarker(coords);
      }
      // 地図が初期化されていない場合は、地図初期化後にマーカーを作成するため何もしない
    } catch (error) {
      console.error("位置情報の取得に失敗しました:", error);
      setError("現在地の取得に失敗しました。東京駅を現在地として設定します。");

      // 東京駅の座標を設定
      const tokyoStationCoords = { lat: 35.6812362, lng: 139.7671248 };
      setCurrentLocation(tokyoStationCoords);
      setCenter(tokyoStationCoords);

      // 地図が初期化済みの場合は中心を更新とマーカー作成
      if (mapRef.current) {
        mapRef.current.setCenter(tokyoStationCoords);
        mapRef.current.setZoom(13);
        createOriginMarker(tokyoStationCoords);
      }
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
    address?: string, // 住所パラメータを追加
    isFromQuery: boolean = false // クエリパラメータからの自動設定かどうか
  ) => {
    console.log("🎯 handlePlaceSelection 呼び出し:", {
      name,
      coords,
      address,
      isFromQuery,
    });

    setError(null);

    const map = mapRef.current;
    if (!map) {
      console.error("❌ 地図が初期化されていません");
      return;
    }

    console.log("✅ 地図が利用可能、目的地マーカーを作成中...");

    // 目的地マーカーを作成
    if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null);
      console.log("🗑️ 既存の目的地マーカーを削除");
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

    console.log("📍 目的地マーカー作成完了:", { name, coords });

    // 目的地マーカーにクリックイベントを追加
    destMarkerRef.current.addListener("click", () => {
      if (infoRef.current) {
        const content = `
              <div style="min-width: 280px; max-width: 320px; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${name}
                  </div>
                  ${
                    address
                      ? `<div style="color: #666; font-size: 10px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${address}</div>`
                      : ""
                  }
                </div>
                <button 
                  id="set-destination-btn"
                  style="
                    width: 100%;
                    padding: 6px 12px;
                    background: #38BDF8;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                    white-space: nowrap;
                  "
                  onmouseover="this.style.background='#0EA5E9'"
                  onmouseout="this.style.background='#38BDF8'"
                >
                  目的地に設定
                </button>
              </div>
            `;

        infoRef.current.setContent(content);
        infoRef.current.open(map, destMarkerRef.current);

        // 目的地に設定ボタンのクリックイベントを設定
        setTimeout(() => {
          const setDestinationBtn = document.getElementById(
            "set-destination-btn"
          );

          if (setDestinationBtn) {
            setDestinationBtn.addEventListener("click", () => {
              // 現在地から出発してルートを表示
              if (currentLocation) {
                setCenter(currentLocation);
                createOriginMarker(currentLocation);
                // ルートを取得
                fetchRoutes();
              } else {
                setError(
                  "現在地が取得できません。現在地の取得をお待ちください。"
                );
              }

              // 情報ウィンドウを閉じる
              infoRef.current?.close();
            });
          }
        }, 100);
      }
    });

    // 地図の中心を目的地に設定
    map.setCenter(coords);

    // 現在地と目的地の距離に基づいて適切なズームレベルを設定
    if (currentLocation) {
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(currentLocation.lat, currentLocation.lng),
        new google.maps.LatLng(coords.lat, coords.lng)
      );

      // 距離に基づいてズームレベルを調整
      let targetZoom = 13; // デフォルト
      if (distance > 50000) {
        // 50km以上
        targetZoom = 10;
      } else if (distance > 20000) {
        // 20km以上
        targetZoom = 11;
      } else if (distance > 10000) {
        // 10km以上
        targetZoom = 12;
      } else if (distance > 5000) {
        // 5km以上
        targetZoom = 13;
      } else if (distance > 2000) {
        // 2km以上
        targetZoom = 14;
      } else {
        targetZoom = 15;
      }

      map.setZoom(targetZoom);
    } else {
      map.setZoom(13); // 現在地がない場合はデフォルト
    }

    // 目的地設定の成功をユーザーに通知
    setError(null);
    console.log("�� 目的地設定完了:", name);

    // クエリパラメータからの自動設定の場合は、自動的にルート案内を開始
    if (isFromQuery && currentLocation) {
      console.log(
        "🚀 クエリパラメータからの自動設定のため、ルート案内を自動開始"
      );
      setTimeout(() => {
        setCenter(currentLocation);
        createOriginMarker(currentLocation);
        // ルートを取得
        fetchRoutes();
      }, 500); // 少し遅延を入れてからルート取得を開始
    } else if (isFromQuery && !currentLocation) {
      console.log(
        "⏳ 現在地がまだ取得されていません。現在地取得後にルート案内を開始します。"
      );
    }

    // 少し遅延を入れてから地図の中心を確実に設定
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.setCenter(coords);
        console.log("🗺️ 地図の中心を目的地に移動:", coords);
      }
    }, 100);

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

    // 検索結果の数字マーカーをクリア
    console.log("🎯 目的地設定時のマーカークリア処理");
    clearSearchResultMarkers();
    setSearchResults([]);

    // 少し遅延を入れてからマーカーの状態を確認
    setTimeout(() => {
      console.log("🎯 マーカークリア後の状態確認:", {
        searchResultMarkersLength: searchResultMarkers.length,
        searchResultsLength: searchResults.length,
      });
    }, 100);

    // 検索クエリをクリア
    setQuery("");
  };

  // 検索処理
  const handleSearch = async () => {
    const searchQuery = query.trim();
    if (!searchQuery) return;

    // 検索開始時に既存の状態を初期化
    setRoutes([]);
    setSelectedRoute(null);
    setWaypoints([]);
    setAlongSpots([]);
    setPlaylist([]);
    setShowPlaylistModal(false);

    // 既存のポリラインをクリア
    if (polyFastRef.current) {
      polyFastRef.current.setMap(null as any);
      polyFastRef.current = null;
    }
    if (polyEcoRef.current) {
      polyEcoRef.current.setMap(null as any);
      polyEcoRef.current = null;
    }

    // 既存の目的地マーカーをクリア
    if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null);
      destMarkerRef.current = null;
    }

    // 沿線スポットのマーカーをクリア
    clearAlongMarkers();

    // 検索結果の数字マーカーをクリア
    console.log("🔍 検索開始前のマーカークリア処理");
    clearSearchResultMarkers();
    setSearchResults([]);

    // 少し遅延を入れてからマーカーの状態を確認
    setTimeout(() => {
      console.log("🔍 マーカークリア後の状態確認:", {
        searchResultMarkersLength: searchResultMarkers.length,
        searchResultsLength: searchResults.length,
      });
    }, 100);

    setError(null);
    setLoadingRoutes(true);

    try {
      // Google Maps Places API (search-text)を使用して検索
      const url = new URL(`${API_BASE}/bff/maps/search-text`);
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("language", "ja");
      url.searchParams.set("region", "JP");
      url.searchParams.set("limit", "5"); // 5件に制限

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`search-text ${res.status}`);

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        // 検索結果を保存
        setSearchResults(data.items);

        // 上位5件を地図上にピンで表示
        createSearchResultMarkers(data.items);

        // 地図の表示範囲を調整（全ての候補が表示されるように）
        if (mapRef.current && data.items.length > 0) {
          // 検索結果の件数に応じて地図の中心位置を決定
          if (data.items.length === 1) {
            // 1件の場合は、その場所に地図の中心を設定
            const singleItem = data.items[0];
            mapRef.current.setCenter({
              lat: singleItem.location.latitude,
              lng: singleItem.location.longitude,
            });
            mapRef.current.setZoom(15); // 1件の場合は適度にズーム
          } else {
            // 2件以上の場合は、座標の中心（平均）に地図の中心を設定
            const bounds = new google.maps.LatLngBounds();

            data.items.forEach((item: SearchResult) => {
              bounds.extend({
                lat: item.location.latitude,
                lng: item.location.longitude,
              });
            });

            // 検索結果の座標の中心を計算
            const centerLat =
              data.items.reduce(
                (sum: number, item: SearchResult) =>
                  sum + item.location.latitude,
                0
              ) / data.items.length;
            const centerLng =
              data.items.reduce(
                (sum: number, item: SearchResult) =>
                  sum + item.location.longitude,
                0
              ) / data.items.length;

            // 地図の中心を検索結果の中心に設定
            mapRef.current.setCenter({ lat: centerLat, lng: centerLng });

            // ピンの散らばり具合を計算（検索結果のみ）
            const points = data.items.map((item: SearchResult) => ({
              lat: item.location.latitude,
              lng: item.location.longitude,
            }));

            let maxDistance = 0;
            for (let i = 0; i < points.length; i++) {
              for (let j = i + 1; j < points.length; j++) {
                const distance =
                  google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(points[i].lat, points[i].lng),
                    new google.maps.LatLng(points[j].lat, points[j].lng)
                  );
                maxDistance = Math.max(maxDistance, distance);
              }
            }

            // 距離に基づいて適切なズームレベルを決定
            let targetZoom = 15; // デフォルト
            if (maxDistance > 50000) {
              // 50km以上
              targetZoom = 9; // 1つ広域
            } else if (maxDistance > 20000) {
              // 20km以上
              targetZoom = 10; // 1つ広域
            } else if (maxDistance > 10000) {
              // 10km以上
              targetZoom = 11; // 1つ広域
            } else if (maxDistance > 5000) {
              // 5km以上
              targetZoom = 12; // 1つ広域
            } else if (maxDistance > 2000) {
              // 2km以上
              targetZoom = 13; // 1つ広域
            } else if (maxDistance > 1000) {
              // 1km以上
              targetZoom = 14; // 1つ広域
            } else {
              // 1km未満
              targetZoom = 15; // 1つ広域
            }

            // 地図の表示範囲を設定
            mapRef.current.fitBounds(bounds);

            // 計算したズームレベルを適用
            setTimeout(() => {
              if (mapRef.current) {
                mapRef.current.setZoom(targetZoom);
              }
            }, 100);
          }
        }

        setError(null);
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

    // ルート取得時に検索結果の数字マーカーをクリア
    console.log("🚗 ルート取得時のマーカークリア処理");
    clearSearchResultMarkers();
    setSearchResults([]);

    // 少し遅延を入れてからマーカーの状態を確認
    setTimeout(() => {
      console.log("🚗 マーカークリア後の状態確認:", {
        searchResultMarkersLength: searchResultMarkers.length,
        searchResultsLength: searchResults.length,
      });
    }, 100);

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

      // エコルートを自動選択（後で復活させる可能性があるため、コードは残す）
      const ecoRoute = data.routes.find((r) => r.type === "eco");
      if (ecoRoute) {
        setSelectedRoute("eco");
        console.log("🚗 エコルートを自動選択");
      } else {
        // エコルートがない場合は最速ルートを選択
        const fastestRoute = data.routes.find((r) => r.type === "fastest");
        if (fastestRoute) {
          setSelectedRoute("fastest");
          console.log("🚗 最速ルートを自動選択（エコルートなし）");
        }
      }

      // 寄り道候補を自動取得（ルート取得完了直後）
      console.log("🗺️ 寄り道候補を自動取得中...");
      // data.routesを直接使用して寄り道候補を取得
      fetchAlongSpots(data.routes || []);

      // ルート表示時は未選択状態にする
      let currentSelectedRoute = null;
      setSelectedRoute(null); // 未選択状態に設定

      // draw polylines
      const geom = (google.maps as any).geometry;
      const pathFast = data.routes.find((r) => r.type === "fastest")?.polyline;
      const pathEco = data.routes.find((r) => r.type === "eco")?.polyline;

      if (polyFastRef.current) polyFastRef.current.setMap(null as any);
      if (polyEcoRef.current) polyEcoRef.current.setMap(null as any);

      // 最速ルートは一時的に非表示（後で復活予定）
      if (false && pathFast) {
        polyFastRef.current = new (google.maps as any).Polyline({
          path: geom.encoding.decodePath(pathFast),
          map,
          strokeColor: "#9ca3af", // 未選択時はグレー
          strokeOpacity: 0.4,
          strokeWeight: 4,
          clickable: true, // クリック可能にする
        });

        // クリックイベントリスナーを追加
        polyFastRef.current.addListener("click", () => {
          setSelectedRoute("fastest");
        });
      }

      // エコルートのみを表示
      if (pathEco) {
        polyEcoRef.current = new (google.maps as any).Polyline({
          path: geom.encoding.decodePath(pathEco),
          map,
          strokeColor: "#ec4899", // エコルートの色（ピンク）
          strokeOpacity: 0.8,
          strokeWeight: 5,
          clickable: false, // クリック不可（選択ボタンがないため）
        });
      }

      // 初期状態では両方のルートをグレーで表示（色更新は不要）

      // 出発地から目的地までが地図に収まるように縮尺を自動調整
      setTimeout(() => {
        if (originMarkerRef.current && destMarkerRef.current) {
          const originPos = originMarkerRef.current.getPosition();
          const destPos = destMarkerRef.current.getPosition();

          if (originPos && destPos) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(originPos);
            bounds.extend(destPos);

            // 境界により広い余白を追加（縮尺を小さく）
            bounds.extend(
              new google.maps.LatLng(
                originPos.lat() + (destPos.lat() - originPos.lat()) * 0.3,
                originPos.lng() + (destPos.lng() - originPos.lng()) * 0.3
              )
            );
            bounds.extend(
              new google.maps.LatLng(
                originPos.lat() - (destPos.lat() - originPos.lat()) * 0.3,
                originPos.lng() - (destPos.lng() - originPos.lng()) * 0.3
              )
            );

            // 地図を境界に合わせて調整
            map.fitBounds(bounds);

            // 最小・最大ズームレベルを設定して、過度な拡大・縮小を防ぐ
            const listener = google.maps.event.addListenerOnce(
              map,
              "bounds_changed",
              () => {
                if (map.getZoom() > 18) {
                  map.setZoom(18);
                } else if (map.getZoom() < 8) {
                  map.setZoom(8);
                }
              }
            );
          }
        }
      }, 400);
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

  const fetchAlongSpots = async (routesToUse?: RouteData[]) => {
    console.log(
      "🔍 fetchAlongSpots開始 - routes:",
      routesToUse?.length || routes.length,
      "selectedRoute:",
      selectedRoute
    );

    // 引数で渡されたルート配列を使用、なければ現在のroutesを使用
    const routesArray = routesToUse || routes;

    // エコルートを優先、なければ最速ルートを使用
    let sr = routesArray.find((r) => r.type === "eco");
    if (!sr) {
      sr = routesArray.find((r) => r.type === "fastest");
    }

    console.log(
      "🔍 選択されたルート:",
      sr ? { type: sr.type, duration: sr.duration_min } : "なし"
    );

    if (!sr) {
      console.error("❌ ルートが見つかりません");
      setError("ルートを選択してください。");
      return;
    }

    console.log("🗺️ 寄り道候補取得開始:", {
      routeType: sr.type,
      routeId: sr.type,
    });

    setLoadingAlong(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/api/v1/spots/along-route`);
      url.searchParams.set("polyline", sr.polyline);
      url.searchParams.set("buffer_m", String(BUFFER_M_DEFAULT));
      url.searchParams.set("user_id", String(USER_ID_DEFAULT));
      url.searchParams.set("followed_only", "1");
      url.searchParams.set("limit", "30");

      console.log("🌐 API呼び出し:", url.toString());

      const res = await fetch(url.toString());
      console.log("🌐 APIレスポンス:", res.status, res.ok);

      if (!res.ok) throw new Error(`along-route ${res.status}`);
      const json = await res.json();
      const items: AlongSpot[] = Array.isArray(json) ? json : json.items ?? [];

      console.log("📊 取得されたスポット数:", items.length);

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

      // デバッグ: 各スポットのis_specialの詳細を確認
      console.log("is_specialの詳細分析:");
      items.forEach((s, index) => {
        console.log(`スポット${index + 1}:`, {
          name: s.name,
          is_special: s.is_special,
          booleanValue: Boolean(s.is_special),
          isTrue: s.is_special === true,
          isFalse: s.is_special === false,
          isNull: s.is_special === null,
          isUndefined: s.is_special === undefined,
        });
      });

      // 均等分布でスポットをソート
      let sortedItems = [...items];

      if (mapRef.current) {
        try {
          const origin =
            originMarkerRef.current?.getPosition() ||
            mapRef.current.getCenter();
          const destination = destMarkerRef.current?.getPosition();

          if (origin && destination) {
            const originCoords = {
              lat: origin.lat(),
              lng: origin.lng(),
            };
            const destCoords = {
              lat: destination.lat(),
              lng: destination.lng(),
            };

            console.log("ルート上でスポットを均等分布させています...");

            // 30件のスポットをルート上で均等に分布（3セクション、各最大10件）
            sortedItems = distributeSpotsEvenly(
              items,
              sr.polyline,
              originCoords,
              destCoords,
              3 // 3セクションに分割して均等分布
            );

            console.log(`均等分布後のスポット数: ${sortedItems.length}`);
          }
        } catch (error) {
          console.warn("スポットソート処理でエラー:", error);
          console.log("エラーのため、元の順序を使用します");
          // エラーが発生した場合は元の順序を使用
          sortedItems = items;
        }
      }

      setAlongSpots(sortedItems);

      // 推し情報を取得してスポット情報を更新
      const spotsWithOshis = await Promise.all(
        sortedItems.map(async (spot) => {
          const oshiNames = await fetchOshiNames(spot.id);
          return { ...spot, oshiNames };
        })
      );
      setAlongSpotsWithOshis(spotsWithOshis);

      // draw markers
      clearAlongMarkers();
      const map = mapRef.current!;

      // 画像の読み込み完了を待ってからマーカーを作成
      const createMarkersWithImages = async () => {
        for (const s of sortedItems) {
          // デバッグ: 各スポットのアイコン設定を確認
          console.log(`スポット「${s.name}」のアイコン設定:`, {
            is_special: s.is_special,
            booleanValue: Boolean(s.is_special),
            willUseHonda: Boolean(s.is_special),
            willUseStar: !Boolean(s.is_special),
          });

          // is_specialの値に基づいてアイコンを設定
          let icon: google.maps.Icon | undefined = undefined;
          if (s.is_special === true) {
            icon = {
              url: "/HondaLogo.svg",
              scaledSize: new google.maps.Size(26, 24),
              anchor: new google.maps.Point(16, 16),
            };
            console.log(`  → HondaLogo.svgを使用 (is_special = true)`);
          } else if (s.is_special === false) {
            icon = {
              url: "/star_logo.svg",
              scaledSize: new google.maps.Size(26, 26),
              anchor: new google.maps.Point(16, 16),
            };
            console.log(`  → star_logo.svgを使用 (is_special = false)`);
          } else {
            // is_specialがnull/undefinedの場合
            console.warn(
              `  → is_specialの値が不正: ${s.is_special}, デフォルトアイコンを使用`
            );
            icon = undefined; // Google Mapsのデフォルトアイコン
          }

          // デバッグ: アイコンオブジェクトの詳細を確認
          console.log(`アイコンオブジェクト:`, icon);

          // 画像の読み込み完了を待つ
          if (icon && icon.url) {
            try {
              await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  console.log(`✅ 画像読み込み成功: ${icon!.url}`);
                  resolve(true);
                };
                img.onerror = () => {
                  console.error(`❌ 画像読み込み失敗: ${icon!.url}`);
                  console.error(
                    `   → ファイルが存在しないか、パスが間違っています`
                  );
                  reject(new Error(`画像読み込み失敗: ${icon!.url}`));
                };
                img.src = icon!.url;

                // タイムアウト設定（5秒）
                setTimeout(() => {
                  reject(new Error(`画像読み込みタイムアウト: ${icon!.url}`));
                }, 5000);
              });
            } catch (error) {
              console.warn(
                `画像読み込みエラー、デフォルトアイコンを使用:`,
                error
              );
              icon = undefined; // デフォルトアイコンを使用
            }
          }

          const m = new google.maps.Marker({
            map,
            position: { lat: s.lat, lng: s.lng },
            title: s.name,
            icon: icon,
          });

          // クリックイベントリスナーを追加
          m.addListener("click", async () => {
            try {
              // 推し情報を取得（backendのspots/{spot_id}/oshisエンドポイントを使用）
              let oshiNames = [];
              try {
                const oshiUrl = new URL(
                  `${API_BASE}/api/v1/spots/${s.id}/oshis`
                );
                const oshiRes = await fetch(oshiUrl.toString());
                if (oshiRes.ok) {
                  const oshiData = await oshiRes.json();
                  // 新しいAPIレスポンス形式に対応
                  if (oshiData.items && Array.isArray(oshiData.items)) {
                    oshiNames = oshiData.items.map(
                      (oshi: any) => oshi.name || `推し#${oshi.id}`
                    );
                  } else if (Array.isArray(oshiData)) {
                    // 配列が直接返される場合
                    oshiNames = oshiData.map(
                      (oshi: any) => oshi.name || `推し#${oshi.id}`
                    );
                  }
                }
              } catch (oshiError) {
                console.warn("推し情報の取得に失敗:", oshiError);
                // 推し情報の取得に失敗しても、他の情報は表示する
              }

              const content = `
                <div style="min-width:250px; padding:16px;">
                  <div style="margin-bottom:16px;">
                    <div style="font-weight:600; color:#333; font-size:16px; margin-bottom:6px;">
                      ${s.name}
                    </div>
                    ${
                      oshiNames.length > 0
                        ? `
                      <div style="font-size:13px;color:#666;margin-bottom:8px;">
                        <span style="color:#666;">${oshiNames.join(", ")}</span>
                      </div>
                    `
                        : `
                      <div style="font-size:13px;color:#666;margin-bottom:8px;">
                        <span style="color:#666;">推し情報がありません</span>
                      </div>
                    `
                    }
                  </div>
                  <button 
                    id="add-wp" 
                    style="
                      width:100%; 
                      padding:10px 16px; 
                      border-radius:8px; 
                      background:#38BDF8; 
                      color:white; 
                      border:none; 
                      font-weight:500; 
                      font-size:14px; 
                      cursor:pointer; 
                      transition:background 0.2s;
                    "
                    onmouseover="this.style.background='#0068b7'"
                    onmouseout="this.style.background='#0068b7'"
                  >
                    経由地に追加
                  </button>
                </div>
              `;

              infoRef.current?.setContent(content);
              infoRef.current?.open({ map, anchor: m });

              // wire button after open
              setTimeout(() => {
                const btn = document.getElementById("add-wp");
                if (btn) btn.onclick = () => addWaypoint(s);
              }, 0);
            } catch (error) {
              console.error("推し情報の取得に失敗:", error);
              // エラー時は簡易表示
              const fallbackContent = `
                <div style="min-width:250px; padding:16px;">
                  <div style="margin-bottom:16px;">
                    <div style="font-weight:600; color:#333; font-size:16px; margin-bottom:6px;">
                      ${s.name}
                    </div>
                    <div style="font-size:13px;color:#666;margin-bottom:8px;">
                      <span style="color:#666;">推し情報の取得に失敗しました</span>
                    </div>
                  </div>
                  <button 
                    id="add-wp" 
                    style="
                      width:100%; 
                      padding:10px 16px; 
                      border-radius:8px; 
                      background:#38BDF8; 
                      color:white; 
                      border:none; 
                      font-weight:500; 
                      font-size:14px; 
                      cursor:pointer; 
                      transition:background 0.2s;
                    "
                    onmouseover="this.style.background='#0EA5E9'"
                    onmouseout="this.style.background='#38BDF8'"
                  >
                    経由地に追加
                  </button>
                </div>
              `;
              infoRef.current?.setContent(fallbackContent);
              infoRef.current?.open({ map, anchor: m });

              setTimeout(() => {
                const btn = document.getElementById("add-wp");
                if (btn) btn.onclick = () => addWaypoint(s);
              }, 0);
            }
          });

          alongMarkersRef.current.push(m);
        }
      };

      // マーカーの作成を開始
      createMarkersWithImages().catch((error) => {
        console.error("マーカー作成中にエラーが発生:", error);
        setError("沿線スポットの表示に失敗しました。");
      });
    } catch (e) {
      console.error(e);
      setError("沿線スポットの取得に失敗しました。");
    } finally {
      setLoadingAlong(false);
    }
  };

  // 推し情報を取得する関数
  const fetchOshiNames = async (spotId: number): Promise<string[]> => {
    try {
      const oshiUrl = new URL(`${API_BASE}/api/v1/spots/${spotId}/oshis`);
      const oshiRes = await fetch(oshiUrl.toString());
      if (oshiRes.ok) {
        const oshiData = await oshiRes.json();
        if (oshiData.items && Array.isArray(oshiData.items)) {
          return oshiData.items.map(
            (oshi: any) => oshi.name || `推し#${oshi.id}`
          );
        } else if (Array.isArray(oshiData)) {
          return oshiData.map((oshi: any) => oshi.name || `推し#${oshi.id}`);
        }
      }
      return [];
    } catch (error) {
      console.warn(`推し情報の取得に失敗 (spot_id: ${spotId}):`, error);
      return [];
    }
  };

  const addWaypoint = (s: AlongSpot) => {
    setWaypoints((prev) => [...prev, { lat: s.lat, lng: s.lng, name: s.name }]);

    // 経由地追加後に吹き出しを閉じる
    if (infoRef.current) {
      infoRef.current.close();
    }
  };

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  // スポットが経由地に追加済みかどうかを判定
  const isWaypointAdded = (spot: AlongSpot) => {
    return waypoints.some((wp) => wp.lat === spot.lat && wp.lng === spot.lng);
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

  // alongSpotsが更新された時にalongSpotsWithOshisも初期化
  useEffect(() => {
    if (alongSpots.length === 0) {
      setAlongSpotsWithOshis([]);
    }
  }, [alongSpots]);

  // -----------------------------
  // Playlist
  // -----------------------------
  const showPlaylistConfirm = () => {
    setShowPlaylistConfirmPopup(true);
  };

  const proposePlaylist = async () => {
    // エコルートを優先、なければ最速ルートを使用
    let sr = routes.find((r) => r.type === "eco");
    if (!sr) {
      sr = routes.find((r) => r.type === "fastest");
    }

    if (!sr) {
      setError("ルートを選択してください。");
      return;
    }

    console.log("🎵 プレイリスト生成開始:", {
      routeType: sr.type,
      duration: sr.duration_min,
    });

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
        max_items: 100,
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

  // 検索結果の表示
  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;

    // ルートが表示されている場合は検索結果を非表示
    if (routes.length > 0) return null;

    return (
      <div className="max-w-md mx-auto px-4 mb-4">
        <div className="bg-white rounded-xl shadow-card border border-gray-200 p-3">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-lg">🔍</span>
            検索結果 ({searchResults.length}件)
          </h3>
          <div className="space-y-1">
            {searchResults.map((result, index) => (
              <div
                key={result.place_id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => {
                  const coords = {
                    lat: result.location.latitude,
                    lng: result.location.longitude,
                  };

                  // 対応するマーカーを見つけて、そのマーカーの位置にInfoWindowを表示
                  if (infoRef.current && mapRef.current) {
                    // 検索結果マーカーの中から、この結果に対応するマーカーを見つける
                    const targetMarker = searchResultMarkers[index];

                    if (targetMarker) {
                      const content = `
                        <div style="min-width: 250px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          <div style="margin-bottom: 16px;">
                            <div style="font-weight: 600; color: #333; font-size: 16px; margin-bottom: 6px;">
                              ${result.name}
                            </div>
                          </div>
                          <button 
                            id="set-destination-btn"
                            style="
                              width: 100%;
                              padding: 10px 16px;
                              background: #38BDF8;
                              color: white;
                              border: none;
                              border-radius: 8px;
                              font-weight: 500;
                              font-size: 14px;
                              cursor: pointer;
                              transition: background 0.2s;
                            "
                            onmouseover="this.style.background='#0EA5E9'"
                            onmouseout="this.style.background='#38BDF8'"
                          >
                            目的地に設定
                          </button>
                        </div>
                      `;

                      infoRef.current.setContent(content);
                      infoRef.current.open(mapRef.current, targetMarker);

                      // 目的地に設定ボタンのクリックイベントを設定
                      setTimeout(() => {
                        const setDestinationBtn = document.getElementById(
                          "set-destination-btn"
                        );
                        if (setDestinationBtn) {
                          setDestinationBtn.addEventListener("click", () => {
                            // 目的地を設定
                            handlePlaceSelection(
                              result.name,
                              coords,
                              result.address
                            );

                            // 現在地から出発してルートを表示
                            if (currentLocation) {
                              setCenter(currentLocation);
                              createOriginMarker(currentLocation);
                              // 検索結果のマーカーをクリア
                              clearSearchResultMarkers();
                              setSearchResults([]);
                              // ルートを取得
                              fetchRoutes();
                            } else {
                              setError(
                                "現在地が取得できません。現在地の取得をお待ちください。"
                              );
                            }
                            // 情報ウィンドウを閉じる
                            infoRef.current?.close();
                          });
                        }
                      }, 100);
                    } else {
                      // マーカーが見つからない場合は地図の中心に表示
                      const content = `
                        <div style="min-width: 250px; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                          <div style="margin-bottom: 16px;">
                            <div style="font-weight: 600; color: #333; font-size: 16px; margin-bottom: 6px;">
                              ${result.name}
                            </div>
                          </div>
                          <button 
                            id="set-destination-btn"
                            style="
                              width: 100%;
                              padding: 10px 16px;
                              background: #38BDF8;
                              color: white;
                              border: none;
                              border-radius: 8px;
                              font-weight: 500;
                              font-size: 14px;
                              cursor: pointer;
                              transition: background 0.2s;
                            "
                            onmouseover="this.style.background='#0EA5E9'"
                            onmouseout="this.style.background='#38BDF8'"
                          >
                            目的地に設定
                          </button>
                        </div>
                      `;

                      infoRef.current.setContent(content);
                      infoRef.current.open(mapRef.current, null);

                      // 目的地に設定ボタンのクリックイベントを設定
                      setTimeout(() => {
                        const setDestinationBtn = document.getElementById(
                          "set-destination-btn"
                        );
                        if (setDestinationBtn) {
                          setDestinationBtn.addEventListener("click", () => {
                            // 目的地を設定
                            handlePlaceSelection(
                              result.name,
                              coords,
                              result.address
                            );

                            // 現在地から出発してルートを表示
                            if (currentLocation) {
                              setCenter(currentLocation);
                              createOriginMarker(currentLocation);
                              // 検索結果のマーカーをクリア
                              clearSearchResultMarkers();
                              setSearchResults([]);
                              // ルートを取得
                              fetchRoutes();
                            } else {
                              setError(
                                "現在地が取得できません。現在地の取得をお待ちください。"
                              );
                            }
                            // 情報ウィンドウを閉じる
                            infoRef.current?.close();
                          });
                        }
                      }, 100);
                    }
                  }
                }}
              >
                <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm mb-1">
                    {result.name}
                  </div>
                  {result.address && (
                    <div className="text-xs text-gray-600 truncate">
                      {result.address}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // カードのクリックイベントが発火しないようにする
                    const coords = {
                      lat: result.location.latitude,
                      lng: result.location.longitude,
                    };

                    // 目的地を設定
                    handlePlaceSelection(result.name, coords, result.address);

                    // 現在地が取得できている場合は、ルート表示を開始
                    if (currentLocation) {
                      setTimeout(() => {
                        setCenter(currentLocation);
                        createOriginMarker(currentLocation);
                        // 検索結果のマーカーをクリア
                        clearSearchResultMarkers();
                        setSearchResults([]);
                        // ルートを取得
                        fetchRoutes();
                      }, 500);
                    } else {
                      setError(
                        "現在地が取得できません。現在地の取得をお待ちください。"
                      );
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
                  title="この場所を目的地に設定してルートを表示"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  目的地に設定
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => {
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

        {/* 検索結果の表示 */}
        {renderSearchResults()}

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
        {/* ルート表示カード */}
        {routes.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex flex-col items-center gap-3">
              {(() => {
                const ecoRoute = routes.find((r) => r.type === "eco");
                const displayRoutes = [];

                if (ecoRoute) displayRoutes.push(ecoRoute);

                return displayRoutes.map((r) => (
                  <div
                    key={r.type}
                    className="w-full flex flex-col items-center gap-3"
                  >
                    {/* 所要時間と距離の表示 */}
                    <div className="w-full flex items-center">
                      <div className="flex-1 text-center text-xl font-semibold text-gray-900">
                        {toMinLabel(r.duration_min)}（{r.distance_km.toFixed(1)}
                        km）
                      </div>

                      {/* プレイリスト提案ボタン */}
                      <button
                        onClick={proposePlaylist}
                        disabled={loadingPlaylist}
                        className="px-4 py-3 bg-cyan-100 hover:bg-cyan-200 disabled:bg-cyan-50 text-gray-800 rounded-xl font-medium transition-colors flex flex-col items-center justify-center gap-1 min-w-[80px] flex-shrink-0"
                        title="プレイリスト提案を表示"
                      >
                        <TbMusic size={20} />
                        <span className="text-xs">プレイリスト提案</span>
                      </button>
                    </div>

                    {/* 出発ボタン（画面いっぱい） */}
                    <button
                      onClick={() => setShowRewardPopup(true)}
                      disabled={!routes.length}
                      className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                      title="出発する"
                    >
                      <TbNavigation size={24} />
                      <span className="text-lg font-semibold">出発する</span>
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* プレイリスト読み込み中の表示 */}
        {routes.length > 0 && loadingPlaylist && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex justify-center">
              <div className="px-6 py-4 bg-purple-100 text-purple-800 rounded-lg border border-purple-200">
                <span className="flex items-center gap-2 text-lg font-medium">
                  <span className="text-2xl">♬</span>
                  プレイリストを構築中...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 経由地チップ */}
        {waypoints.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="flex flex-wrap gap-2">
              {waypoints.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs"
                >
                  <span>経由：{w.name}</span>
                  <button
                    onClick={() => removeWaypoint(i)}
                    className="ml-1 w-4 h-4 flex items-center justify-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-200 rounded-full transition-colors"
                    aria-label="経由地を削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 沿線スポットリスト */}
        {alongSpots.length > 0 && (
          <div className="max-w-md mx-auto px-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              おすすめ推しスポット ({alongSpots.length}件)
              {false && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  - {false ? "進行度順" : false ? "均等分布" : "バランス重視"}
                </span>
              )}
            </h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {alongSpotsWithOshis.map((s, index) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200 transition-all ${
                    isWaypointAdded(s) ? "opacity-50 grayscale" : ""
                  }`}
                >
                  {/* サムネイル */}
                  <div className="flex-shrink-0">
                    {s.is_special === true ? (
                      <img
                        src="/HondaLogo.svg"
                        alt="Honda"
                        className="w-8 h-8"
                      />
                    ) : (
                      <img
                        src="/star_logo.svg"
                        alt="Star"
                        className="w-8 h-8"
                      />
                    )}
                  </div>

                  {/* 場所名と推し名 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 mb-1">
                      {s.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {s.oshiNames && s.oshiNames.length > 0 ? (
                        <span>{s.oshiNames.join(", ")}</span>
                      ) : (
                        <span>推し情報がありません</span>
                      )}
                    </div>
                  </div>

                  {/* 経由地に追加ボタン */}
                  <button
                    onClick={() => addWaypoint(s)}
                    disabled={isWaypointAdded(s)}
                    className={`px-3 py-1 text-white rounded-lg text-xs flex-shrink-0 transition-colors ${
                      isWaypointAdded(s)
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {isWaypointAdded(s) ? "追加済み" : "経由地に追加"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* プレイリスト */}
        {playlist.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 mb-4">
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
                <div className="text-base font-bold text-gray-600 mb-2"></div>
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
                          Snowman 他
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

              {/* リストを表示ボタン */}
              <button
                onClick={() => setShowPlaylistConfirmPopup(true)}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>📋</span>
                リストを表示
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
              {error && (
                <span
                  className={`ml-2 ${
                    error.includes("地図上をクリック")
                      ? "text-blue-600 font-medium"
                      : "text-red-600"
                  }`}
                >
                  {error}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 出発地入力モーダル */}

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

      {/* ご褒美ポップアップ */}
      <RewardPopup
        isOpen={showRewardPopup}
        onClose={() => setShowRewardPopup(false)}
      />

      {/* プレイリスト取得確認ポップアップ */}
      {showPlaylistConfirmPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">🎵</span>
                プレイリスト提案
              </h3>
              <button
                onClick={() => setShowPlaylistConfirmPopup(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* プレイリスト概要 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-3">
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

              {/* 推し名表示 */}
              <div className="mb-3">
                <div className="text-sm text-gray-600 mb-2">関連推し:</div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
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
                      return oshiList.slice(0, 8).map((oshi, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                        >
                          {oshi}
                        </span>
                      ));
                    } else {
                      return (
                        <span className="text-sm text-gray-500 italic">
                          Snowman 他
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* プレイリスト詳細 */}
            <div className="p-4 max-h-[40vh] overflow-auto">
              <div className="space-y-2">
                {playlist.slice(0, 10).map((p, index) => (
                  <div
                    key={p.content_id}
                    className="p-2 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono min-w-[30px]">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {p.title || `コンテンツ #${p.content_id}`}
                        </div>
                        <div className="text-xs text-gray-600">
                          {toMinLabel(p.duration_min)}
                          {p.lang && <span className="ml-2">({p.lang})</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {playlist.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    他 {playlist.length - 10} 件...
                  </div>
                )}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPlaylistConfirmPopup(false);
                    setShowPlaylistModal(true);
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => setShowPlaylistConfirmPopup(false)}
                  className="flex-1 py-3 bg-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <BottomNav />
    </div>
  );
}
