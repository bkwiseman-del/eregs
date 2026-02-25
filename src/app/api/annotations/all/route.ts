import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/annotations/all?type=NOTE|HIGHLIGHT|BOOKMARK
// Returns all annotations for the authenticated user, optionally filtered by type
// Grouped by section, sorted by most recent first
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeFilter = request.nextUrl.searchParams.get("type");

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const where: Record<string, unknown> = { userId: user.id };
    if (typeFilter && ["NOTE", "HIGHLIGHT", "BOOKMARK"].includes(typeFilter)) {
      where.type = typeFilter;
    }

    const annotations = await db.annotation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(annotations);
  } catch (e) {
    console.error("annotations/all GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
