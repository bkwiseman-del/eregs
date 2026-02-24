import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  try {
    const cached = await db.cachedImage.findUnique({ where: { path } });
    if (!cached) return new NextResponse("Not found", { status: 404 });

    return new NextResponse(cached.data, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=604800", // 7 days
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
