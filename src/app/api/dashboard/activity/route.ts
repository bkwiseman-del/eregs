import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { makeParagraphId } from "@/lib/annotations";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "10"), 50);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch recent annotations of each type (fetch extra to account for merging)
    const fetchLimit = limit + offset;
    const [highlights, notes, bookmarks] = await Promise.all([
      db.highlight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: fetchLimit,
      }),
      db.note.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: fetchLimit,
      }),
      db.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: fetchLimit,
      }),
    ]);

    // Merge and sort by date
    type Activity = {
      id: string;
      type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
      section: string;
      part: string;
      paragraphId?: string;
      _paragraphIds?: string[];
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
        paragraphId: h.paragraphIds[0],
        _paragraphIds: h.paragraphIds,
        createdAt: h.createdAt.toISOString(),
      })),
      ...notes.map(n => ({
        id: n.id,
        type: "NOTE" as const,
        section: n.sectionId,
        part: n.cfr49Part,
        paragraphId: n.paragraphIds[0],
        _paragraphIds: n.paragraphIds,
        note: n.text.length > 120 ? n.text.slice(0, 120) + "…" : n.text,
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

    const total = activities.length;

    // Paginate
    const result = activities.slice(offset, offset + limit);

    // Enrich with section titles and text snippets from cached content
    const sectionIds = [...new Set(result.map(a => a.section))];
    if (sectionIds.length > 0) {
      const cached = await db.cachedSection.findMany({
        where: { section: { in: sectionIds } },
        select: { section: true, title: true, contentJson: true },
      });

      const sectionData = new Map<string, { title: string; content: Array<{ label?: string; text: string }> }>();
      for (const c of cached) {
        try {
          sectionData.set(c.section, { title: c.title, content: JSON.parse(c.contentJson) });
        } catch { /* skip malformed */ }
      }

      for (const a of result) {
        const data = sectionData.get(a.section);
        if (!data) continue;

        a.sectionTitle = data.title;

        if (a.type === "BOOKMARK") {
          // First ~150 chars of section content
          const texts: string[] = [];
          let len = 0;
          for (const node of data.content) {
            if (!node.text || len > 150) break;
            texts.push(node.text);
            len += node.text.length;
          }
          const combined = texts.join(" ");
          a.textSnippet = combined.length > 150 ? combined.slice(0, 150) + "…" : combined;
        } else if (a._paragraphIds?.length) {
          // Highlights and notes: match specific paragraphs
          const pidSet = new Set(a._paragraphIds);
          const texts: string[] = [];
          for (let i = 0; i < data.content.length; i++) {
            const node = data.content[i];
            const pid = makeParagraphId(a.section, node.label, i);
            if (pidSet.has(pid)) {
              const prefix = node.label ? `(${node.label}) ` : "";
              texts.push(prefix + node.text);
            }
          }
          if (texts.length > 0) {
            const combined = texts.join(" ");
            a.textSnippet = combined.length > 150 ? combined.slice(0, 150) + "…" : combined;
          }
        }

        // Clean up internal field from response
        delete a._paragraphIds;
      }
    }

    return NextResponse.json({ items: result, total, hasMore: offset + result.length < total });
  } catch (e) {
    console.error("dashboard/activity error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
