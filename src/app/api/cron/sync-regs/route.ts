import { NextRequest, NextResponse } from "next/server";
import { syncAllRegulations } from "@/lib/ecfr";

// This route can be called by:
// 1. Vercel Cron (add to vercel.json)
// 2. Manual trigger: POST /api/cron/sync-regs with the secret
// 3. External cron service (e.g. cron-job.org)

export const maxDuration = 300; // 5 minutes — Vercel Pro limit

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[sync-regs] Starting regulation sync...");
    const result = await syncAllRegulations();
    console.log(`[sync-regs] Done: ${result.sections} sections, ${result.parts} parts, ${result.errors.length} errors`);

    return NextResponse.json({
      success: true,
      sections: result.sections,
      parts: result.parts,
      errors: result.errors.slice(0, 20), // Limit error output
      totalErrors: result.errors.length,
    });
  } catch (e) {
    console.error("[sync-regs] Fatal error:", e);
    return NextResponse.json({ error: "Sync failed", details: String(e) }, { status: 500 });
  }
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request);
}
