import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    const limit = searchParams.get("limit") || "50";

    // バックエンドのFastAPIにリクエストを転送
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    const queryParams = new URLSearchParams();

    if (q) queryParams.append("q", q);
    if (category) queryParams.append("category", category);
    if (limit) queryParams.append("limit", limit);

    const backendResponse = await fetch(
      `${backendUrl}/api/v1/oshis?${queryParams}`
    );

    if (!backendResponse.ok) {
      throw new Error(`Backend error: ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("API proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
