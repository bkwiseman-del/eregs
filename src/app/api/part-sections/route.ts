import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Returns all cached sections for a given part — used by client-side reader
// GET /api/part-sections?part=395
export async function GET(request: NextRequest) {
  const part = request.nextUrl.searchParams.get("part");
  if (!part) return NextResponse.json({ error: "Missing part" }, { status: 400 });

  try {
    const sections = await db.cachedSection.findMany({
      where: { part },
      select: {
        section: true,
        title: true,
        contentJson: true,
        subpartLabel: true,
        subpartTitle: true,
      },
      orderBy: { section: "asc" },
    });

    // Parse contentJson for each section
    const parsed = sections.map(s => ({
      part,
      section: s.section,
      title: s.title,
      content: JSON.parse(s.contentJson),
      subpartLabel: s.subpartLabel,
      subpartTitle: s.subpartTitle,
    }));

    return NextResponse.json(parsed, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    console.error("part-sections error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
