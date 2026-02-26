import { NextRequest, NextResponse } from "next/server";
import { syncPart, syncStructure, checkStaleness } from "@/lib/ecfr";

// Sync one part at a time to stay within Vercel timeout limits.
// Usage:
//   POST /api/cron/sync-regs?step=structure      — sync all TOCs (fast, ~5s)
//   POST /api/cron/sync-regs?step=part&part=390   — sync one part's sections (incremental)
//   GET  /api/cron/sync-regs?step=check&part=390  — check if part is stale
//
// To sync everything, run structure first, then each part.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const step = request.nextUrl.searchParams.get("step") || "structure";
  const part = request.nextUrl.searchParams.get("part");

  try {
    if (step === "structure") {
      const result = await syncStructure();
      return NextResponse.json({ success: true, ...result });
    }

    if (step === "part" && part) {
      const result = await syncPart(part);
      return NextResponse.json({ success: true, ...result });
    }

    if (step === "check" && part) {
      const result = await checkStaleness(part);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({
      error: "Invalid params. Use ?step=structure, ?step=part&part=390, or ?step=check&part=390",
    }, { status: 400 });
  } catch (e) {
    console.error("[sync-regs] Error:", e);
    return NextResponse.json({ error: "Sync failed", details: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
