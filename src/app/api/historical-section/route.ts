import { NextRequest, NextResponse } from "next/server";
import { auth, canAccessPro } from "@/lib/auth";
import { parseXml, isAppendixSection, slugToAppendixIdentifier } from "@/lib/ecfr";

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = "49";

// GET /api/historical-section?section=390.5&date=2025-06-15
// Pro-gated — fetches regulation content as of a specific date from eCFR
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPro(session)) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const section = request.nextUrl.searchParams.get("section");
  const date = request.nextUrl.searchParams.get("date");

  if (!section || !date) {
    return NextResponse.json({ error: "Missing section or date" }, { status: 400 });
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  try {
    // Determine part from section
    const part = section.includes("-app")
      ? section.split("-")[0]
      : section.split(".")[0];

    // Build eCFR URL for the historical date
    let url: string;
    if (isAppendixSection(section)) {
      const identifier = slugToAppendixIdentifier(section);
      if (!identifier) {
        return NextResponse.json({ error: "Invalid appendix section" }, { status: 400 });
      }
      url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&appendix=${encodeURIComponent(identifier)}`;
    } else {
      url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${section}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Section not found at this date" }, { status: 404 });
      }
      return NextResponse.json({ error: `eCFR returned ${res.status}` }, { status: 502 });
    }

    const xml = await res.text();
    const parsed = parseXml(xml, part, section);
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse regulation content" }, { status: 500 });
    }

    return NextResponse.json({
      part,
      section: parsed.section,
      title: parsed.title,
      content: parsed.content,
      subpartLabel: parsed.subpartLabel,
      subpartTitle: parsed.subpartTitle,
      date,
    });
  } catch (e) {
    console.error("historical-section error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
