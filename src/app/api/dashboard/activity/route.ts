import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "10"), 30);

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch recent annotations of each type
    const [highlights, notes, bookmarks] = await Promise.all([
      db.highlight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.note.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      db.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    // Merge and sort by date
    type Activity = {
      id: string;
      type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
      section: string;
      part: string;
      sectionTitle?: string;
      textSnippet?: string;
      note?: string;
      createdAt: string;
    };

    const activities: Activity[] = [
      ...highlights.map(h => ({
        id: h.id,
        type: "HIGHLIGHT" as const,
        section: h.sectionId,
        part: h.cfr49Part,
        createdAt: h.createdAt.toISOString(),
      })),
      ...notes.map(n => ({
        id: n.id,
        type: "NOTE" as const,
        section: n.sectionId,
        part: n.cfr49Part,
        note: n.text.length > 80 ? n.text.slice(0, 80) + "…" : n.text,
        createdAt: n.updatedAt.toISOString(),
      })),
      ...bookmarks.map(b => ({
        id: b.id,
        type: "BOOKMARK" as const,
        section: b.sectionId,
        part: b.cfr49Part,
        createdAt: b.createdAt.toISOString(),
      })),
    ];

    // Sort by most recent
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Take top N
    const result = activities.slice(0, limit);

    // Enrich with section titles
    const sectionIds = [...new Set(result.map(a => a.section))];
    if (sectionIds.length > 0) {
      const cached = await db.cachedSection.findMany({
        where: { section: { in: sectionIds } },
        select: { section: true, title: true },
      });
      const titleMap = new Map(cached.map(c => [c.section, c.title]));
      for (const a of result) {
        a.sectionTitle = titleMap.get(a.section);
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("dashboard/activity error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
