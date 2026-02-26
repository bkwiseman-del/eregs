import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ReaderAnnotation } from "@/lib/annotations";
import { makeParagraphId } from "@/lib/annotations";

/** Enrich annotations with text snippets and section titles from CachedSection */
async function enrichAnnotations(annotations: ReaderAnnotation[]): Promise<void> {
  if (annotations.length === 0) return;

  const sectionIds = [...new Set(annotations.map(a => a.section))];

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

  for (const a of annotations) {
    const data = sectionData.get(a.section);
    if (!data) continue;

    // Section title for all types
    a.sectionTitle = data.title;

    if (a.type === "BOOKMARK") {
      // Bookmarks get first ~200 chars of the section content
      const texts: string[] = [];
      let len = 0;
      for (const node of data.content) {
        if (!node.text || len > 200) break;
        texts.push(node.text);
        len += node.text.length;
      }
      const combined = texts.join(" ");
      a.textSnippet = combined.length > 200 ? combined.slice(0, 200) + "…" : combined;
      continue;
    }

    // Highlights and notes: match specific paragraphs
    if (!a.paragraphIds?.length) continue;
    const pidSet = new Set(a.paragraphIds);
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
      a.textSnippet = combined.length > 200 ? combined.slice(0, 200) + "…" : combined;
    }
  }
}

// GET /api/annotations/all?type=NOTE|HIGHLIGHT|BOOKMARK
// Returns all annotations for the authenticated user, optionally filtered by type
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeFilter = request.nextUrl.searchParams.get("type");

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const results: ReaderAnnotation[] = [];

    if (!typeFilter || typeFilter === "HIGHLIGHT") {
      const highlights = await db.highlight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      results.push(...highlights.map(h => ({
        id: h.id,
        type: "HIGHLIGHT" as const,
        paragraphId: h.paragraphIds[h.paragraphIds.length - 1] ?? "",
        paragraphIds: h.paragraphIds,
        part: h.cfr49Part,
        section: h.sectionId,
        color: h.color,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.createdAt.toISOString(),
        impactedByChange: h.impactedByChange,
      })));
    }

    if (!typeFilter || typeFilter === "NOTE") {
      const notes = await db.note.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
      });
      results.push(...notes.map(n => ({
        id: n.id,
        type: "NOTE" as const,
        paragraphId: n.paragraphIds[n.paragraphIds.length - 1] ?? "",
        paragraphIds: n.paragraphIds,
        part: n.cfr49Part,
        section: n.sectionId,
        note: n.text,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        impactedByChange: n.impactedByChange,
      })));
    }

    if (!typeFilter || typeFilter === "BOOKMARK") {
      const bookmarks = await db.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      results.push(...bookmarks.map(b => ({
        id: b.id,
        type: "BOOKMARK" as const,
        paragraphId: "",
        part: b.cfr49Part,
        section: b.sectionId,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.createdAt.toISOString(),
        impactedByChange: b.impactedByChange,
      })));
    }

    // Enrich all annotations with text snippets and section titles
    await enrichAnnotations(results);

    return NextResponse.json(results);
  } catch (e) {
    console.error("annotations/all GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
