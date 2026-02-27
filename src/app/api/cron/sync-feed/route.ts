import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling sync dependencies in the client
    const { syncVideos, syncPodcasts, syncArticles } = await import("@/../scripts/sync-feed");

    const [videos, podcasts, articles] = await Promise.all([
      syncVideos(),
      syncPodcasts(),
      syncArticles(),
    ]);

    return NextResponse.json({
      success: true,
      synced: { videos, podcasts, articles },
    });
  } catch (e) {
    console.error("[sync-feed] Error:", e);
    return NextResponse.json({ error: "Sync failed", details: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
