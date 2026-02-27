import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, canAccessPro } from "@/lib/auth";
import { getVersionsForPart, isAppendixSection, slugToAppendixIdentifier } from "@/lib/ecfr";

// GET /api/section-history?section=390.5
// Pro-gated — returns changelog + version timeline for a section
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPro(session)) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const section = request.nextUrl.searchParams.get("section");
  if (!section) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }

  try {
    const regSectionId = `49-${section}`;
    const part = section.includes("-app")
      ? section.split("-")[0]
      : section.split(".")[0];

    // 1. Fetch our local changelog entries (from sync-detected changes)
    const changelogs = await db.regChangelog.findMany({
      where: { sectionId: regSectionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        versionDate: true,
        changeType: true,
        summary: true,
        federalRegCitation: true,
        effectiveDate: true,
        createdAt: true,
      },
    });

    // 2. Fetch eCFR version history for richer timeline data
    const allVersions = await getVersionsForPart(part);

    // Match this section's identifier in eCFR data
    const ecfrId = isAppendixSection(section)
      ? slugToAppendixIdentifier(section) ?? section
      : section;

    const sectionVersions = allVersions
      .filter(v => v.identifier === ecfrId)
      .sort((a, b) => b.date.localeCompare(a.date));

    // 3. Merge: eCFR versions provide the full timeline, changelogs add our detected changes
    const timeline = sectionVersions.map(v => ({
      date: v.date,
      amendmentDate: v.amendment_date,
      substantive: v.substantive,
      removed: v.removed,
      name: v.name,
      // Match to our changelog if we have one
      changelog: changelogs.find(c => c.versionDate === v.date) ?? null,
    }));

    return NextResponse.json({
      section,
      regSectionId,
      timeline,
      changelogs,
    });
  } catch (e) {
    console.error("section-history error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
