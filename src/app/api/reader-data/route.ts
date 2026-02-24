import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/reader-data?part=395
// Returns { toc, sections } for an entire part in one call.
// This is the ONLY data endpoint the reader client needs.
export async function GET(request: NextRequest) {
  const part = request.nextUrl.searchParams.get("part");
  if (!part) return NextResponse.json({ error: "Missing part" }, { status: 400 });

  const onlyToc = request.nextUrl.searchParams.get("toc") === "1";

  try {
    // Always fetch TOC
    const cachedToc = await db.cachedPartToc.findUnique({ where: { part } });
    const toc = cachedToc
      ? { part: cachedToc.part, title: cachedToc.title, subparts: JSON.parse(cachedToc.tocJson) }
      : null;

    // If ?toc=1, return only TOC (lightweight, for sidebar expansion of non-current parts)
    if (onlyToc) {
      return NextResponse.json({ toc, sections: [] }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    // Fetch all sections for this part
    const rows = await db.cachedSection.findMany({
      where: { part },
      select: { section: true, title: true, contentJson: true, subpartLabel: true, subpartTitle: true },
    });

    const sections = rows.map(s => ({
      part,
      section: s.section,
      title: s.title,
      content: JSON.parse(s.contentJson),
      subpartLabel: s.subpartLabel,
      subpartTitle: s.subpartTitle,
    }));

    return NextResponse.json({ toc, sections }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("reader-data error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
