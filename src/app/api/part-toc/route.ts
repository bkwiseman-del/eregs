import { NextRequest, NextResponse } from "next/server";
import { fetchPartStructure } from "@/lib/ecfr";

// GET /api/part-toc?part=395
export async function GET(request: NextRequest) {
  const part = request.nextUrl.searchParams.get("part");
  if (!part) return NextResponse.json({ error: "Missing part" }, { status: 400 });

  const toc = await fetchPartStructure(part);
  if (!toc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toc, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
