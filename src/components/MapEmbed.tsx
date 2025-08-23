"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { TbLocationFilled } from "react-icons/tb";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

type Props = {
  height?: string; // 例: "320px"
  rounded?: string; // 例: "1rem"
  showSpecialToggle?: boolean;
  onCenterChange?: (
    center: { lat: number; lng: number },
    reason: "initial" | "search" | "move"
  ) => void;
  onBBoxChange?: (bbox: string) => void; // 地図の表示範囲（BBox）が変更された時のコールバック
};

async function apiGet<T>(
  path: string,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(
      ([k, v]) => v != null && url.searchParams.set(k, String(v))
    );
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function mapToBBox(map: google.maps.Map | null): string | null {
  if (!map) return null;
  const b = map.getBounds();
  if (!b) return null;
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return `${sw.lat()},${sw.lng()},${ne.lat()},${ne.lng()}`;
}

export default function MapEmbed({
  height = "320px",
  rounded = "1rem",
  showSpecialToggle = true,
  onCenterChange,
  onBBoxChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const currentLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("読み込み中…");
  const [specialOnly, setSpecialOnly] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);

  // --- Google Maps 読み込み ---
  useEffect(() => {
    let cancelled = false;
    if (!MAPS_KEY) {
      setStatus("Maps APIキー未設定");
      return;
    }
    const loader = new Loader({
      apiKey: MAPS_KEY,
      version: "weekly",
      libraries: ["places", "geometry"],
    });
    loader
      .load()
      .then(() => {
        if (cancelled || !wrapRef.current) return;
        const google = (window as any).google as typeof window.google;
        mapRef.current = new google.maps.Map(wrapRef.current, {
          center: { lat: 35.659, lng: 139.7 }, // 渋谷近辺
          zoom: 13, // 車移動を前提として適度な範囲を表示
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        setMapsReady(true);
        // 初期位置をコールバックで通知
        if (onCenterChange) {
          onCenterChange({ lat: 35.659, lng: 139.7 }, "initial");
        }
        // 初期BBoxも通知
        if (onBBoxChange) {
          const bbox = mapToBBox(mapRef.current);
          if (bbox) {
            onBBoxChange(bbox);
          }
        }
      })
      .catch((e) => {
        console.error(e);
        setStatus("Google Mapsの読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- 初回＋移動時フェッチ ---
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google as typeof window.google;
    let timer: any;

    const idleListener = mapRef.current.addListener("idle", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // 地図ドラッグ時は自動取得せず、再検索ボタンのみ表示
        setShowRefreshButton(true);
        // BBoxの通知は再検索ボタンを押した時のみ行う
      }, 350);
    });

    // 初期表示時は現在地取得せず、初期位置（渋谷）を維持
    setTimeout(loadSpots, 400);

    return () => {
      if (idleListener) google.maps.event.removeListener(idleListener);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      // 現在地マーカーもクリーンアップ
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setMap(null);
        currentLocationMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady, specialOnly]);

  async function loadSpots() {
    try {
      if (!mapRef.current) return;
      const bbox = mapToBBox(mapRef.current);
      if (!bbox) return;
      const c = mapRef.current.getCenter();
      const origin = c ? `${c.lat()},${c.lng()}` : undefined;
      setStatus("周辺スポット取得中…");

      const data = await apiGet<{ count: number; items: any[] }>(
        "/api/v1/spots",
        {
          bbox,
          origin,
          is_special: specialOnly ? 1 : undefined,
          limit: 10,
        }
      );

      // 既存マーカー掃除
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const google = (window as any).google as typeof window.google;
      data.items.forEach((s) => {
        const marker = new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: s.lat, lng: s.lng },
          title: s.name,
        });
        marker.addListener("click", async () => {
          try {
            const [detail, contents, oshis] = await Promise.all([
              apiGet<any>(`/api/v1/spots/${s.id}`),
              apiGet<any>(`/api/v1/spots/${s.id}/contents`, {
                langs: "ja,en",
                max_duration: 20,
              }),
              apiGet<any>(`/api/v1/spots/${s.id}/oshis`),
            ]);

            const html = `
              <div style="max-width:280px">
                <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1a1a1a">${escapeHtml(
                  detail.name || ""
                )}</div>
                <div style="font-size:12px;color:#555;margin-bottom:6px">${escapeHtml(
                  detail.address || ""
                )}</div>
                ${
                  detail.description
                    ? `<div style="font-size:12px;color:#333;margin-bottom:6px;line-height:1.4">${escapeHtml(
                        detail.description || ""
                      )}</div>`
                    : ""
                }
                <div style="font-size:12px;color:#333;margin-bottom:6px">距離: ${
                  s.distance_km ?? "-"
                } km</div>
                <div style="font-size:12px;color:#333;margin-bottom:6px">タイプ: ${escapeHtml(
                  s.type || "-"
                )}${s.is_special ? "（特殊）" : ""}</div>
                ${
                  oshis.items && oshis.items.length > 0
                    ? `
                <div style="font-size:12px;color:#111;margin-top:8px;margin-bottom:4px;font-weight:600">関連推し</div>
                <div style="margin-bottom:8px">
                  ${oshis.items
                    .map(
                      (o: any) =>
                        `<span style="display:inline-block;background:#f0f0f0;color:#333;padding:2px 6px;margin:1px;border-radius:4px;font-size:11px">${escapeHtml(
                          o.name
                        )}</span>`
                    )
                    .join("")}
                </div>
                `
                    : ""
                }
                <div style="font-size:12px;color:#111;margin-top:8px;margin-bottom:4px;font-weight:600">関連コンテンツ（<=20分）</div>
                ${
                  (contents.items || [])
                    .slice(0, 3)
                    .map(
                      (c: any) =>
                        `<div style='font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px'>・${escapeHtml(
                          c.title || ""
                        )}${
                          c.duration_min ? `（${c.duration_min}分）` : ""
                        }</div>`
                    )
                    .join("") ||
                  '<div style="font-size:12px;color:#888">なし</div>'
                }
              </div>`;
            infoRef.current!.setContent(html);
            infoRef.current!.open({ anchor: marker, map: mapRef.current! });
          } catch (error) {
            console.error("スポット詳細取得エラー:", error);
            infoRef.current!.setContent(
              '<div style="font-size:12px;color:#c00">詳細の取得に失敗しました</div>'
            );
            infoRef.current!.open({ anchor: marker, map: mapRef.current! });
          }
        });
        markersRef.current.push(marker);
      });
      setStatus(`取得: ${data.count}件`);
    } catch (e: any) {
      console.error(e);
      setStatus(`取得失敗: ${e.message || e}`);
    }
  }

  async function onSearch() {
    const text = q.trim();
    if (!text) return;
    try {
      const ac = await apiGet<{ predictions: any[] }>(
        "/bff/maps/autocomplete",
        { q: text, language: "ja" }
      );
      const first = ac.predictions?.[0];
      if (!first) {
        setStatus("候補なし");
        return;
      }
      const d = await apiGet<any>("/bff/maps/place-details", {
        place_id: first.place_id,
        language: "ja",
      });

      const lat =
        d?.result?.geometry?.location?.lat ??
        d?.location?.latitude ??
        d?.location?.lat ??
        d?.lat;
      const lng =
        d?.result?.geometry?.location?.lng ??
        d?.location?.longitude ??
        d?.location?.lng ??
        d?.lng;

      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        mapRef.current
      ) {
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(13); // 車移動を前提として適度な範囲を表示
        // 検索後にコールバックを呼び出し
        if (onCenterChange) {
          onCenterChange({ lat, lng }, "search");
        }
        // 検索後にBBoxを通知
        if (onBBoxChange) {
          const bbox = mapToBBox(mapRef.current);
          if (bbox) {
            onBBoxChange(bbox);
          }
        }
        // 検索後は再検索ボタンを非表示
        setShowRefreshButton(false);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 再検索ボタンを押した時の処理
  async function onRefreshArea() {
    if (!mapRef.current) return;
    setShowRefreshButton(false);
    setStatus("このエリアで再検索中…");

    // 再検索時にBBoxを通知
    if (onBBoxChange) {
      const bbox = mapToBBox(mapRef.current);
      if (bbox) {
        onBBoxChange(bbox);
      }
    }

    await loadSpots();
  }

  // ---- ここから: 検索UIを「外出し」 ----
  const Controls = (
    <div
      className="w-full mb-2"
      style={{
        background: "#fff",
        padding: 10,
        borderRadius: 10,
        boxShadow: "0 2px 12px rgba(0,0,0,.15)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="地名で検索（例: 渋谷駅）"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            flex: 1,
            minWidth: 0,
          }}
        />
        <button
          onClick={onSearch}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#f7f7f7",
          }}
        >
          検索
        </button>
      </div>

      {/* {showSpecialToggle && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={specialOnly}
            onChange={(e) => setSpecialOnly(e.target.checked)}
          />
          特殊スポットのみ
        </label>
      )} */}
    </div>
  );

  return (
    <div
      className="w-full"
      style={{ borderRadius: rounded, overflow: "hidden" }}
    >
      {/* 外出しコントロール */}
      {Controls}

      {/* 地図カード本体（検索UIは重ねない） */}
      <div
        className="relative w-full shadow-card"
        style={{
          height,
          borderRadius: rounded,
          overflow: "hidden",
          background: "#e5e7eb",
        }}
      >
        <div ref={wrapRef} className="absolute inset-0" />

        {/* 再検索ボタン */}
        {showRefreshButton && (
          <div
            className="absolute z-30"
            style={{
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <button
              onClick={onRefreshArea}
              style={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #ddd",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "500",
                color: "#333",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              </svg>
              このエリアで再検索
            </button>
          </div>
        )}

        {/* ステータス */}
        <div
          className="absolute z-30"
          style={{
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,.95)",
            padding: 8,
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {status}
        </div>

        {/* 現在地ボタン（右下） */}
        <div
          className="absolute z-30"
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
                  const position = { lat, lng };

                  // 地図の中心を現在地に移動
                  mapRef.current!.setCenter(position);
                  mapRef.current!.setZoom(13);

                  // 既存の現在地マーカーを削除
                  if (currentLocationMarkerRef.current) {
                    currentLocationMarkerRef.current.setMap(null);
                  }

                  // 新しい現在地マーカーを作成・表示
                  currentLocationMarkerRef.current =
                    createCurrentLocationMarker(position, mapRef.current!);

                  // 現在地移動後は再検索ボタンを非表示
                  setShowRefreshButton(false);
                },
                () => setStatus("現在地が取得できませんでした"),
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
  );
}

function escapeHtml(s: any) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ((
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        } as any
      )[m])
  );
}

// 現在地マーカーを作成する関数
function createCurrentLocationMarker(
  position: { lat: number; lng: number },
  map: google.maps.Map
): google.maps.Marker {
  const google = (window as any).google as typeof window.google;
  return new google.maps.Marker({
    position,
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#4285F4", // Google Blue
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeWeight: 2,
    },
    title: "現在地",
    zIndex: 1000, // 他のマーカーより前面に表示
  });
}
