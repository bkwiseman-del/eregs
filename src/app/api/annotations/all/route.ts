import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ReaderAnnotation } from "@/lib/annotations";

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
        paragraphId: h.paragraphId,
        part: h.cfr49Part,
        section: h.sectionId,
        color: h.color,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.createdAt.toISOString(),
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
      })));
    }

    return NextResponse.json(results);
  } catch (e) {
    console.error("annotations/all GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
