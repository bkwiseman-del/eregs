import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, canAccessPro } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPro(session)) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type"); // VIDEO, PODCAST, ARTICLE
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  try {
    const where = type ? { type: type as "VIDEO" | "PODCAST" | "ARTICLE" } : {};

    const [items, total] = await Promise.all([
      db.feedItem.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.feedItem.count({ where }),
    ]);

    return NextResponse.json({ items, total, hasMore: offset + items.length < total });
  } catch (e) {
    console.error("dashboard/feed error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
