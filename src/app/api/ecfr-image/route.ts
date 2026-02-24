import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Only allow fetching from ecfr.gov
  if (!url.startsWith("https://www.ecfr.gov") && !url.startsWith("/")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const fullUrl = url.startsWith("/") ? `https://www.ecfr.gov${url}` : url;

  try {
    const res = await fetch(fullUrl, {
      headers: {
        "Referer": "https://www.ecfr.gov",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) return new NextResponse("Not found", { status: 404 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/gif";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
