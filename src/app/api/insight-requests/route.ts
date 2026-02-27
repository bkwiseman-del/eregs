import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.user.findUnique({ where: { email: session.user.email } });
}

// POST /api/insight-requests — vote for content on a section
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { section, type } = body as { section?: string; type?: string };

  if (!section || !type || !["VIDEO", "ARTICLE"].includes(type)) {
    return NextResponse.json({ error: "Missing or invalid section/type" }, { status: 400 });
  }

  // Strip T suffix for consistency
  const cleanSection = section.replace(/[Tt]$/, "");

  try {
    // Upsert — unique constraint prevents duplicates per user/section/type
    await db.insightRequest.upsert({
      where: {
        userId_section_type: {
          userId: user.id,
          section: cleanSection,
          type: type as "VIDEO" | "ARTICLE",
        },
      },
      create: {
        userId: user.id,
        section: cleanSection,
        type: type as "VIDEO" | "ARTICLE",
      },
      update: {}, // no-op if already exists
    });

    // Return total vote count for this section/type
    const count = await db.insightRequest.count({
      where: { section: cleanSection, type: type as "VIDEO" | "ARTICLE" },
    });

    return NextResponse.json({ voted: true, count });
  } catch (e: any) {
    console.error("insight-request POST error:", e);
    return NextResponse.json({ error: "Failed", detail: e?.message ?? String(e) }, { status: 500 });
  }
}

// GET /api/insight-requests?section=390.5 — check user's votes + counts for a section
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawSection = request.nextUrl.searchParams.get("section");
  if (!rawSection) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }

  const section = rawSection.replace(/[Tt]$/, "");

  try {
    const [videoCt, articleCt, userVotes] = await Promise.all([
      db.insightRequest.count({ where: { section, type: "VIDEO" } }),
      db.insightRequest.count({ where: { section, type: "ARTICLE" } }),
      db.insightRequest.findMany({
        where: { userId: user.id, section },
        select: { type: true },
      }),
    ]);

    const voted = new Set(userVotes.map(v => v.type));

    return NextResponse.json({
      videos: { count: videoCt, voted: voted.has("VIDEO") },
      articles: { count: articleCt, voted: voted.has("ARTICLE") },
    });
  } catch (e) {
    console.error("insight-request error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
