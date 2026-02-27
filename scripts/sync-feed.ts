import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { google } from "googleapis";
import Parser from "rss-parser";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDurationISO(iso: string): { display: string; secs: number } {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? "0");
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? "0");
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? "0");
  const totalSecs = h * 3600 + m * 60 + s;
  const mins = Math.floor(totalSecs / 60);
  const remSecs = totalSecs % 60;
  const display = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`
    : `${m}:${String(remSecs).padStart(2, "0")}`;
  return { display, secs: totalSecs };
}

function parseRssDuration(dur: string): { display: string; secs: number } {
  // RSS durations can be "HH:MM:SS", "MM:SS", or raw seconds
  const parts = dur.split(":").map(Number);
  let totalSecs: number;
  if (parts.length === 3) {
    totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    totalSecs = parts[0] * 60 + parts[1];
  } else {
    totalSecs = parts[0] || 0;
  }
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const display = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return { display, secs: totalSecs };
}

async function scrapeMetadata(url: string): Promise<{ title: string; description: string; image: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; eRegs/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { title: "", description: "", image: "" };
    const html = await res.text();

    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/);
    const title = ogTitle?.[1] ?? titleTag?.[1] ?? "";

    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/);
    const description = ogDesc?.[1] ?? metaDesc?.[1] ?? "";

    const ogImage = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"/);
    let image = ogImage?.[1] ?? "";

    // Fix Wix image URLs with zero dimensions (w_0,h_0) — Wix returns 400 for these
    if (image.includes("wixstatic.com") && /\/v1\/fi[lt]\/w_0,h_0/.test(image)) {
      image = image.replace(/\/v1\/fi[lt]\/[^/]+\//, "/v1/fill/w_1000,h_600,al_c,q_85/");
    }

    return {
      title: title.replace(/\s+/g, " ").trim(),
      description: description.replace(/\s+/g, " ").trim(),
      image: image.trim(),
    };
  } catch {
    console.warn(`  ⚠ Failed to scrape: ${url}`);
    return { title: "", description: "", image: "" };
  }
}

// ── 1. YouTube Playlist ──────────────────────────────────────────────────────

const PLAYLIST_ID = "PLKFRi6fwIR2GO3yje9N3gFGjQCI84a93P";

async function syncVideos() {
  console.log("🎬 Syncing YouTube playlist videos...");

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("  ❌ YOUTUBE_API_KEY not set in .env.local");
    return 0;
  }

  const youtube = google.youtube({ version: "v3", auth: apiKey });

  // Collect all video IDs from the playlist
  const videoIds: string[] = [];
  let nextPageToken: string | undefined;

  do {
    const res = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: PLAYLIST_ID,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) videoIds.push(vid);
    }
    nextPageToken = res.data.nextPageToken ?? undefined;
  } while (nextPageToken);

  console.log(`  Found ${videoIds.length} videos in playlist`);

  // Fetch full metadata in batches of 50
  let count = 0;
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const res = await youtube.videos.list({
        part: ["snippet", "contentDetails"],
        id: batch,
      });

      for (const item of res.data.items ?? []) {
        const vid = item.id!;
        const snippet = item.snippet!;
        const durationISO = item.contentDetails?.duration ?? "";
        const { display, secs } = durationISO ? parseDurationISO(durationISO) : { display: null, secs: null };

        await db.feedItem.upsert({
          where: { externalId: vid },
          create: {
            type: "VIDEO",
            externalId: vid,
            title: snippet.title ?? "Untitled Video",
            description: snippet.description?.slice(0, 500) ?? null,
            url: `https://www.youtube.com/watch?v=${vid}`,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.standard?.url ?? snippet.thumbnails?.high?.url ?? null,
            publisher: "Trucksafe",
            duration: display,
            durationSecs: secs,
            publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : new Date(),
          },
          update: {
            title: snippet.title ?? "Untitled Video",
            description: snippet.description?.slice(0, 500) ?? null,
            thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.standard?.url ?? snippet.thumbnails?.high?.url ?? null,
            duration: display,
            durationSecs: secs,
            publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined,
          },
        });
        count++;
      }
    } catch (err) {
      console.error(`  ❌ YouTube API error for batch starting at ${i}:`, err);
    }
  }

  console.log(`  ✅ Synced ${count} videos`);
  return count;
}

// ── 2. Podcast RSS ───────────────────────────────────────────────────────────

const PODCAST_RSS = "https://anchor.fm/s/61fe1580/podcast/rss";

async function syncPodcasts() {
  console.log("🎙  Syncing podcast episodes from RSS...");

  const parser = new Parser({
    customFields: {
      item: [
        ["itunes:episode", "itunesEpisode"] as any,
        ["itunes:duration", "itunesDuration"] as any,
        ["itunes:image", "itunesImage", { keepArray: false }] as any,
      ],
      feed: [
        ["itunes:image", "itunesImage", { keepArray: false }] as any,
      ],
    },
  });

  const feed = await parser.parseURL(PODCAST_RSS);
  const feedItunes = feed as any;
  const coverArt = feedItunes.itunes?.image
    ?? feedItunes.itunesImage?.$?.href
    ?? feedItunes.itunesImage?.href
    ?? feedItunes.image?.url
    ?? null;
  console.log(`  Cover art: ${coverArt ? "found" : "not found"}`);

  let count = 0;

  for (const item of feed.items) {
    const guid = item.guid ?? item.link ?? "";
    if (!guid) continue;

    const durStr = (item as any).itunesDuration ?? "";
    const { display, secs } = durStr ? parseRssDuration(durStr) : { display: null, secs: null };
    const epNum = parseInt((item as any).itunesEpisode ?? "0") || null;

    // Get audio URL from enclosure
    const audioUrl = item.enclosure?.url ?? null;

    // Episode-specific art, or fall back to feed cover art
    const itemArt = (item as any).itunesImage?.$?.href
      ?? (item as any).itunesImage?.href
      ?? (item as any).itunes?.image
      ?? coverArt;

    await db.feedItem.upsert({
      where: { externalId: guid },
      create: {
        type: "PODCAST",
        externalId: guid,
        title: item.title ?? "Untitled Episode",
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? null,
        url: item.link ?? "",
        thumbnailUrl: itemArt,
        publisher: "Trucksafe",
        duration: display,
        durationSecs: secs,
        audioUrl,
        episodeNum: epNum,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      },
      update: {
        title: item.title ?? "Untitled Episode",
        description: item.contentSnippet?.slice(0, 500) ?? item.content?.slice(0, 500) ?? null,
        thumbnailUrl: itemArt,
        duration: display,
        durationSecs: secs,
        audioUrl,
        episodeNum: epNum,
      },
    });
    count++;
  }

  console.log(`  ✅ Synced ${count} podcast episodes`);
  return count;
}

// ── 3. Trucksafe Blog Articles ───────────────────────────────────────────────

const BLOG_RSS = "https://www.trucksafe.com/blog-feed.xml";

async function syncArticles() {
  console.log("📰 Syncing articles from Trucksafe blog RSS...");

  const parser = new Parser();
  const feed = await parser.parseURL(BLOG_RSS);

  let count = 0;

  for (const item of feed.items) {
    const url = item.link ?? "";
    if (!url) continue;

    // Use URL path as external ID
    const slug = new URL(url).pathname;

    let thumbnailUrl: string | null = null;
    let description = item.contentSnippet?.slice(0, 500) ?? null;

    // Scrape og:image and richer description from the article page
    const meta = await scrapeMetadata(url);
    if (meta.image) thumbnailUrl = meta.image;
    if (meta.description && (!description || description.length < 50)) {
      description = meta.description.slice(0, 500);
    }

    // Estimate read time from description length (~200 words/min, ~5 chars/word)
    const wordCount = (description?.length ?? 0) / 5;
    const readMins = Math.max(3, Math.ceil(wordCount / 200));

    await db.feedItem.upsert({
      where: { externalId: slug },
      create: {
        type: "ARTICLE",
        externalId: slug,
        title: item.title ?? "Untitled Article",
        description,
        url,
        thumbnailUrl,
        publisher: "Trucksafe",
        duration: `${readMins} min read`,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      },
      update: {
        title: item.title ?? "Untitled Article",
        description,
        thumbnailUrl,
        duration: `${readMins} min read`,
      },
    });
    count++;
  }

  console.log(`  ✅ Synced ${count} articles`);
  return count;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Syncing dashboard feed...\n");

  const [videos, podcasts, articles] = await Promise.all([
    syncVideos(),
    syncPodcasts(),
    syncArticles(),
  ]);

  console.log(`\n✅ Feed sync complete:`);
  console.log(`   ${videos} videos`);
  console.log(`   ${podcasts} podcast episodes`);
  console.log(`   ${articles} articles`);

  await db.$disconnect();
}

export { syncVideos, syncPodcasts, syncArticles };

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
