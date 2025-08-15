import { useEffect, useRef, useState } from "react";

// --- 環境設定 ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const MAPS_KEY = import.meta.env.VITE_MAPS_API_KEY || ""; // .env で設定

// APIラッパ
async function apiGet<T>(
  path: string,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params)
    Object.entries(params).forEach(
      ([k, v]) => v != null && url.searchParams.set(k, String(v))
    );
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

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const [mapsReady, setMapsReady] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("準備中...");
  const [specialOnly, setSpecialOnly] = useState(false);

  // Google Maps 初期化
  useEffect(() => {
    if (
      !mapsReady ||
      !containerRef.current ||
      typeof window === "undefined" ||
      !(window as any).google
    )
      return;
    const google = (window as any).google as typeof window.google;

    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: 35.659, lng: 139.7 }, // 渋谷近辺
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoRef.current = new google.maps.InfoWindow();

    // idle で /spots を再取得（デバウンス）
    let timer: any;
    const idleListener = mapRef.current.addListener("idle", () => {
      clearTimeout(timer);
      timer = setTimeout(loadSpots, 350);
    });

    // 初回：現在地が取れたら中心に、ダメでもそのままロード
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapRef.current!.setCenter({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          mapRef.current!.setZoom(15);
          setTimeout(loadSpots, 400);
        },
        () => setTimeout(loadSpots, 400),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setTimeout(loadSpots, 400);
    }

    return () => {
      google.maps.event.removeListener(idleListener);
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsReady]);

  async function loadSpots() {
    try {
      const bbox = mapToBBox(mapRef.current);
      if (!bbox) return;
      const c = mapRef.current!.getCenter();
      const origin = c ? `${c.lat()},${c.lng()}` : undefined;
      setStatus("周辺スポット取得中...");
      const data = await apiGet<{ count: number; items: any[] }>(
        "/api/v1/spots",
        {
          bbox,
          origin,
          is_special: specialOnly ? 1 : undefined,
          limit: 50,
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
            const [detail, contents] = await Promise.all([
              apiGet<any>(`/api/v1/spots/${s.id}`),
              apiGet<any>(`/api/v1/spots/${s.id}/contents`, {
                langs: "ja,en",
                max_duration: 20,
              }),
            ]);
            const html = `
                <div style="max-width:260px">
                  <div style="font-weight:700;margin-bottom:4px">${escapeHtml(
                    detail.name || ""
                  )}</div>
                  <div style="font-size:12px;color:#555;margin-bottom:6px">${escapeHtml(
                    detail.address || ""
                  )}</div>
                  <div style="font-size:12px;color:#333;margin-bottom:6px">距離: ${
                    s.distance_km ?? "-"
                  } km</div>
                  <div style="font-size:12px;color:#333;margin-bottom:6px">タイプ: ${escapeHtml(
                    s.type || "-"
                  )}${s.is_special ? "（特殊）" : ""}</div>
                  <div style="font-size:12px;color:#111;margin-top:8px;margin-bottom:4px">関連コンテンツ（<=20分）</div>
                  ${
                    (contents.items || [])
                      .slice(0, 5)
                      .map(
                        (c: any) => `
                  <div style='font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>・${escapeHtml(
                    c.title || ""
                  )}${c.duration_min ? `（${c.duration_min}分）` : ""}</div>
                `
                      )
                      .join("") ||
                    '<div style="font-size:12px;color:#888">なし</div>'
                  }
                </div>`;
            infoRef.current!.setContent(html);
            infoRef.current!.open({ anchor: marker, map: mapRef.current! });
          } catch (e) {
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
      // Places Autocomplete（New）
      const ac = await apiGet<{ predictions: any[] }>(
        "/bff/maps/autocomplete",
        { q: text, language: "ja" }
      );
      const first = ac.predictions?.[0];
      if (!first) {
        setStatus("候補なし");
        return;
      }
      const d = await apiGet<{
        location?: { latitude: number; longitude: number };
      }>("/bff/maps/place-details", {
        place_id: first.place_id,
        language: "ja",
      });
      if (d.location) {
        mapRef.current!.setCenter({
          lat: d.location.latitude,
          lng: d.location.longitude,
        });
        mapRef.current!.setZoom(15);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function recenterToHere() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current!.setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        mapRef.current!.setZoom(15);
      },
      () => setStatus("現在地が取得できませんでした"),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  // Google Maps スクリプト読み込み
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=maps,marker`;
      script.onload = () => setMapsReady(true);
      document.head.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* UI */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 2,
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
              width: 280,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
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
          <button
            onClick={recenterToHere}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#f7f7f7",
            }}
          >
            現在地
          </button>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={specialOnly}
            onChange={(e) => {
              setSpecialOnly(e.target.checked);
              setTimeout(loadSpots, 0);
            }}
          />{" "}
          特殊スポットのみ
        </label>
      </div>

      <div ref={containerRef} style={{ height: "100vh", width: "100%" }} />
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          zIndex: 2,
          background: "rgba(255,255,255,.95)",
          padding: 8,
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {status}
      </div>
    </>
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
