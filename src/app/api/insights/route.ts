import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, canAccessPro } from "@/lib/auth";

// GET /api/insights?section=390.5
// Pro-gated — returns insights grouped by type for a section
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPro(session)) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const rawSection = request.nextUrl.searchParams.get("section");
  if (!rawSection) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }

  // Strip trailing "T"/"t" suffix — table variants (e.g., 390.3T) share insights with their base section
  const section = rawSection.replace(/[Tt]$/, "");

  try {
    const insights = await db.insight.findMany({
      where: {
        sectionIds: { has: section },
        active: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const guidance = insights.filter(i => i.type === "FMCSA_GUIDANCE");
    const videos = insights.filter(i => i.type === "VIDEO");
    const articles = insights.filter(i => i.type === "ARTICLE");

    return NextResponse.json({ guidance, videos, articles });
  } catch (e) {
    console.error("insights error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
