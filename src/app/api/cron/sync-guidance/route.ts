import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 30;

/**
 * Guidance sync status + manual trigger endpoint.
 *
 * GET /api/cron/sync-guidance
 *   Returns current guidance stats (count, latest entry date, last sync info).
 *
 * POST /api/cron/sync-guidance?action=trigger
 *   Triggers the GitHub Actions sync-guidance workflow via GitHub API.
 *   Requires GITHUB_TOKEN secret with repo workflow dispatch permission.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get guidance stats from DB
    const totalCount = await db.insight.count({
      where: { type: "FMCSA_GUIDANCE" },
    });

    const latestEntry = await db.insight.findFirst({
      where: { type: "FMCSA_GUIDANCE" },
      orderBy: { publishedAt: "desc" },
      select: { title: true, publishedAt: true, createdAt: true },
    });

    const lastImported = await db.insight.findFirst({
      where: { type: "FMCSA_GUIDANCE" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    // Count by section coverage
    const withSections = await db.insight.count({
      where: {
        type: "FMCSA_GUIDANCE",
        sectionIds: { isEmpty: false },
      },
    });

    return NextResponse.json({
      status: "ok",
      guidance: {
        total: totalCount,
        withSections,
        withoutSections: totalCount - withSections,
        latestEntry: latestEntry
          ? {
              title: latestEntry.title,
              publishedAt: latestEntry.publishedAt,
              importedAt: latestEntry.createdAt,
            }
          : null,
        lastSync: lastImported?.updatedAt ?? null,
      },
    });
  } catch (e) {
    console.error("[sync-guidance] Error:", e);
    return NextResponse.json(
      { error: "Failed to get guidance status", details: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");

  if (action === "trigger") {
    // Trigger GitHub Actions workflow
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO; // e.g., "bkwiseman-del/eregs"

    if (!githubToken || !repo) {
      return NextResponse.json(
        {
          error: "GitHub integration not configured",
          hint: "Set GITHUB_TOKEN and GITHUB_REPO environment variables",
        },
        { status: 500 }
      );
    }

    try {
      const mode =
        request.nextUrl.searchParams.get("mode") || "incremental";

      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/sync-guidance.yml/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ref: "main",
            inputs: { mode },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { error: "Failed to trigger workflow", details: err },
          { status: res.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Triggered sync-guidance workflow (mode: ${mode})`,
      });
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to trigger workflow", details: String(e) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Unknown action. Use ?action=trigger" },
    { status: 400 }
  );
}
