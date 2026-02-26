import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const imgPath = request.nextUrl.searchParams.get("path");
  if (!imgPath) return new NextResponse("Missing path", { status: 400 });

  try {
    // Check cache first
    const cached = await db.cachedImage.findUnique({ where: { path: imgPath } });
    if (cached) {
      return new NextResponse(cached.data, {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=604800",
        },
      });
    }

    // Fallback: fetch from eCFR and cache for next time
    const url = imgPath.startsWith("http") ? imgPath : `https://www.ecfr.gov${imgPath}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "image/*,*/*",
      },
      redirect: "follow",
    });

    if (!res.ok) return new NextResponse("Not found", { status: 404 });

    const contentType = res.headers.get("content-type") || "image/gif";
    if (contentType.includes("text/html")) {
      return new NextResponse("Blocked by eCFR", { status: 502 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Cache asynchronously — don't block response
    db.cachedImage.upsert({
      where: { path: imgPath },
      create: { path: imgPath, contentType, data: buffer },
      update: { contentType, data: buffer },
    }).catch(() => {});

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
