import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { ReaderAnnotation } from "@/lib/annotations";

async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.user.findUnique({ where: { email: session.user.email } });
}

// GET /api/annotations?section=395.1
// Returns all annotations for the authenticated user in a given section
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const section = request.nextUrl.searchParams.get("section");
  if (!section) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [highlights, notes, bookmarks] = await Promise.all([
      db.highlight.findMany({ where: { userId: user.id, sectionId: section } }),
      db.note.findMany({ where: { userId: user.id, sectionId: section } }),
      db.bookmark.findMany({ where: { userId: user.id, sectionId: section } }),
    ]);

    const merged: ReaderAnnotation[] = [
      ...highlights.map(h => ({
        id: h.id,
        type: "HIGHLIGHT" as const,
        paragraphId: h.paragraphIds[h.paragraphIds.length - 1] ?? "",
        paragraphIds: h.paragraphIds,
        part: h.cfr49Part,
        section: h.sectionId,
        color: h.color,
        createdAt: h.createdAt.toISOString(),
        impactedByChange: h.impactedByChange,
      })),
      ...notes.map(n => ({
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
      })),
      ...bookmarks.map(b => ({
        id: b.id,
        type: "BOOKMARK" as const,
        paragraphId: "",
        part: b.cfr49Part,
        section: b.sectionId,
        createdAt: b.createdAt.toISOString(),
        impactedByChange: b.impactedByChange,
      })),
    ];

    return NextResponse.json(merged);
  } catch (e) {
    console.error("annotations GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/annotations
// Body: { type, paragraphId?, paragraphIds?, part, section, note?/text? }
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { type, paragraphId, paragraphIds, part, section, note, text } = body;

    if (!type || !part || !section) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (type === "HIGHLIGHT") {
      const pids: string[] = paragraphIds || (paragraphId ? [paragraphId] : []);
      if (pids.length === 0) {
        return NextResponse.json({ error: "Missing paragraphIds" }, { status: 400 });
      }
      const highlight = await db.highlight.create({
        data: { userId: user.id, cfr49Part: part, sectionId: section, paragraphIds: pids },
      });
      return NextResponse.json({
        id: highlight.id, type: "HIGHLIGHT",
        paragraphId: pids[pids.length - 1],
        paragraphIds: pids,
        part: highlight.cfr49Part, section: highlight.sectionId,
        color: highlight.color, createdAt: highlight.createdAt.toISOString(),
      }, { status: 201 });
    }

    if (type === "NOTE") {
      const pids: string[] = paragraphIds || (paragraphId ? [paragraphId] : []);
      const noteText = note ?? text ?? "";
      if (pids.length === 0) {
        return NextResponse.json({ error: "Missing paragraphIds" }, { status: 400 });
      }
      const created = await db.note.create({
        data: {
          userId: user.id, cfr49Part: part, sectionId: section,
          paragraphIds: pids, text: noteText,
        },
      });
      return NextResponse.json({
        id: created.id, type: "NOTE",
        paragraphId: pids[pids.length - 1],
        paragraphIds: pids,
        part: created.cfr49Part, section: created.sectionId,
        note: created.text, createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      }, { status: 201 });
    }

    if (type === "BOOKMARK") {
      // Toggle: delete if exists, create if not
      const existing = await db.bookmark.findUnique({
        where: { userId_sectionId: { userId: user.id, sectionId: section } },
      });
      if (existing) {
        await db.bookmark.delete({ where: { id: existing.id } });
        return NextResponse.json({ deleted: true, id: existing.id });
      }
      const bookmark = await db.bookmark.create({
        data: { userId: user.id, cfr49Part: part, sectionId: section },
      });
      return NextResponse.json({
        id: bookmark.id, type: "BOOKMARK",
        paragraphId: "", part: bookmark.cfr49Part, section: bookmark.sectionId,
        createdAt: bookmark.createdAt.toISOString(),
      }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e) {
    console.error("annotations POST error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/annotations?id=xxx&type=HIGHLIGHT|NOTE|BOOKMARK
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const type = request.nextUrl.searchParams.get("type");

    // Try the specified type first, then fallback to checking all tables
    if (type === "HIGHLIGHT" || !type) {
      const hl = await db.highlight.findUnique({ where: { id } });
      if (hl) {
        if (hl.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
        await db.highlight.delete({ where: { id } });
        return NextResponse.json({ deleted: true });
      }
      if (type === "HIGHLIGHT") return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (type === "NOTE" || !type) {
      const note = await db.note.findUnique({ where: { id } });
      if (note) {
        if (note.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
        await db.note.delete({ where: { id } });
        return NextResponse.json({ deleted: true });
      }
      if (type === "NOTE") return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (type === "BOOKMARK" || !type) {
      const bm = await db.bookmark.findUnique({ where: { id } });
      if (bm) {
        if (bm.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
        await db.bookmark.delete({ where: { id } });
        return NextResponse.json({ deleted: true });
      }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("annotations DELETE error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH /api/annotations
// Body: { id, note/text }  — notes only
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { id, note, text } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await db.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.note.update({
      where: { id },
      data: { text: note ?? text ?? "" },
    });

    return NextResponse.json({
      id: updated.id, type: "NOTE",
      paragraphId: updated.paragraphIds[updated.paragraphIds.length - 1] ?? "",
      paragraphIds: updated.paragraphIds,
      part: updated.cfr49Part, section: updated.sectionId,
      note: updated.text, createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("annotations PATCH error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
