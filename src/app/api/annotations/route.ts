import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

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
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const annotations = await db.annotation.findMany({
      where: { userId: user.id, section },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(annotations);
  } catch (e) {
    console.error("annotations GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/annotations
// Body: { type, paragraphId, part, section, note?, regVersion }
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { type, paragraphId, part, section, note, regVersion } = body;

    if (!type || !paragraphId || !part || !section) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // For highlights, check if one already exists (toggle behavior)
    if (type === "HIGHLIGHT") {
      const existing = await db.annotation.findFirst({
        where: { userId: user.id, paragraphId, type: "HIGHLIGHT" },
      });
      if (existing) {
        // Toggle off — delete the highlight
        await db.annotation.delete({ where: { id: existing.id } });
        return NextResponse.json({ deleted: true, id: existing.id });
      }
    }

    const annotation = await db.annotation.create({
      data: {
        userId: user.id,
        type,
        paragraphId,
        part,
        section,
        note: note ?? null,
        regVersion: regVersion || "",
      },
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (e) {
    console.error("annotations POST error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/annotations?id=xxx
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
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify ownership
    const annotation = await db.annotation.findUnique({ where: { id } });
    if (!annotation || annotation.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.annotation.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("annotations DELETE error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH /api/annotations
// Body: { id, note }
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id, note } = await request.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const annotation = await db.annotation.findUnique({ where: { id } });
    if (!annotation || annotation.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.annotation.update({
      where: { id },
      data: { note: note ?? null },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("annotations PATCH error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
