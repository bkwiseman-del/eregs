import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { google } from "googleapis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const DOCS = path.join(__dirname, "..", "docs");

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  return text.trim().split("\n").map(line => line.split(","));
}

function extractVideoId(url: string): string | null {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function parseDuration(iso: string): number {
  // PT1H2M3S → minutes
  const h = iso.match(/(\d+)H/)?.[1] ?? "0";
  const m = iso.match(/(\d+)M/)?.[1] ?? "0";
  const s = iso.match(/(\d+)S/)?.[1] ?? "0";
  return Math.round(parseInt(h) * 60 + parseInt(m) + parseInt(s) / 60);
}

function cleanSection(s: string): string {
  // Remove trailing "T"/"t" suffix used for table variants (e.g., "390.5T" → "390.5")
  return s.replace(/[Tt]$/, "").trim();
}

async function scrapeMetadata(url: string): Promise<{ title: string; description: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; eRegs/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { title: "", description: "" };
    const html = await res.text();

    // Extract og:title or <title>
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"/);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/);
    const title = ogTitle?.[1] ?? titleTag?.[1] ?? "";

    // Extract og:description or meta description
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"/);
    const metaDesc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/)
      ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/);
    const description = ogDesc?.[1] ?? metaDesc?.[1] ?? "";

    return {
      title: title.replace(/\s+/g, " ").trim(),
      description: description.replace(/\s+/g, " ").trim(),
    };
  } catch {
    console.warn(`  ⚠ Failed to scrape: ${url}`);
    return { title: "", description: "" };
  }
}

// ── 1. Guidance ──────────────────────────────────────────────────────────────

async function seedGuidance() {
  console.log("📖 Parsing guidance from Excel...");
  const wb = XLSX.readFile(path.join(DOCS, "eRegs Guidance.xlsx"));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  const insights: {
    type: "FMCSA_GUIDANCE";
    title: string;
    body: string;
    url: string | null;
    sectionIds: string[];
    publisher: string;
  }[] = [];

  for (const row of rows) {
    const section = cleanSection(String(row["Section Number"] ?? row["section"] ?? ""));
    const qa = String(row["Question/Answer"] ?? row["question/answer"] ?? "").trim();
    const dotLink = String(row["DOT Link"] ?? row["dot link"] ?? "").trim();

    if (!section || !qa) continue;

    // Extract question for the title (up to first "ANSWER:" or first "?")
    let title = qa;
    const qMatch = qa.match(/QUESTION:\s*(.*?)(?:\s*ANSWER:|$)/s);
    if (qMatch) {
      title = qMatch[1].trim();
      // Truncate to ~120 chars at a word boundary
      if (title.length > 120) {
        title = title.slice(0, 120).replace(/\s+\S*$/, "") + "…";
      }
    }

    insights.push({
      type: "FMCSA_GUIDANCE",
      title,
      body: qa,
      url: dotLink || null,
      sectionIds: [section],
      publisher: "FMCSA",
    });
  }

  console.log(`  Found ${insights.length} guidance entries`);
  return insights;
}

// ── 2. Videos ────────────────────────────────────────────────────────────────

async function seedVideos() {
  console.log("🎬 Parsing videos from CSV...");
  const csv = fs.readFileSync(path.join(DOCS, "eRegs Video Links 2.11.24.csv"), "utf-8");
  const rows = parseCSV(csv);
  const header = rows.shift(); // remove header row

  // Build map: videoId → set of sections
  const videoSections = new Map<string, Set<string>>();
  const videoUrls = new Map<string, string>();

  for (const row of rows) {
    const section = cleanSection(row[0]);
    if (!section) continue;
    for (let i = 1; i < row.length; i++) {
      const url = row[i]?.trim();
      if (!url) continue;
      const vid = extractVideoId(url);
      if (!vid) continue;
      if (!videoSections.has(vid)) {
        videoSections.set(vid, new Set());
        videoUrls.set(vid, `https://www.youtube.com/watch?v=${vid}`);
      }
      videoSections.get(vid)!.add(section);
    }
  }

  const videoIds = Array.from(videoSections.keys());
  console.log(`  Found ${videoIds.length} unique videos across ${rows.length} section mappings`);

  // Fetch metadata from YouTube
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("  ❌ YOUTUBE_API_KEY not set in .env.local");
    return [];
  }

  const youtube = google.youtube({ version: "v3", auth: apiKey });
  const insights: {
    type: "VIDEO";
    title: string;
    body: string | null;
    url: string;
    thumbnailUrl: string | null;
    durationMinutes: number | null;
    sectionIds: string[];
    publisher: string;
  }[] = [];

  // Batch in groups of 50 (YouTube API limit)
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
        const duration = item.contentDetails?.duration ?? "";

        insights.push({
          type: "VIDEO",
          title: snippet.title ?? "Untitled Video",
          body: snippet.description?.slice(0, 300) ?? null,
          url: videoUrls.get(vid)!,
          thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
          durationMinutes: duration ? parseDuration(duration) : null,
          sectionIds: Array.from(videoSections.get(vid) ?? []),
          publisher: "Trucksafe",
        });
      }
    } catch (err) {
      console.error(`  ❌ YouTube API error for batch starting at ${i}:`, err);
    }
  }

  console.log(`  Fetched metadata for ${insights.length} videos`);
  return insights;
}

// ── 3. Articles ──────────────────────────────────────────────────────────────

async function seedArticles() {
  console.log("📰 Parsing articles from CSV...");
  const csv = fs.readFileSync(path.join(DOCS, "eRegs Trucksafe Articles 2.13.24.csv"), "utf-8");
  const rows = parseCSV(csv);
  rows.shift(); // remove header

  // Build map: url → set of sections
  const articleSections = new Map<string, Set<string>>();

  for (const row of rows) {
    const section = cleanSection(row[0]);
    if (!section) continue;
    for (let i = 1; i < row.length; i++) {
      const url = row[i]?.trim();
      if (!url || !url.startsWith("http")) continue;
      if (!articleSections.has(url)) articleSections.set(url, new Set());
      articleSections.get(url)!.add(section);
    }
  }

  const urls = Array.from(articleSections.keys());
  console.log(`  Found ${urls.length} unique articles across ${rows.length} section mappings`);

  const insights: {
    type: "ARTICLE";
    title: string;
    body: string | null;
    url: string;
    sectionIds: string[];
    publisher: string;
  }[] = [];

  // Scrape metadata (throttled, 3 concurrent)
  const CONCURRENCY = 3;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(url => scrapeMetadata(url)));

    for (let j = 0; j < batch.length; j++) {
      const url = batch[j];
      const { title, description } = results[j];

      // Fallback title from URL slug
      const fallbackTitle = url
        .split("/post/")[1]
        ?.replace(/-/g, " ")
        .replace(/^\w/, c => c.toUpperCase()) ?? "Untitled Article";

      insights.push({
        type: "ARTICLE",
        title: title || fallbackTitle,
        body: description || null,
        url,
        sectionIds: Array.from(articleSections.get(url) ?? []),
        publisher: "Trucksafe",
      });
    }

    if (i + CONCURRENCY < urls.length) {
      process.stdout.write(`  Scraped ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length} articles\r`);
    }
  }

  console.log(`  Scraped metadata for ${insights.length} articles`);
  return insights;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seeding insights...\n");

  const [guidance, videos, articles] = await Promise.all([
    seedGuidance(),
    seedVideos(),
    seedArticles(),
  ]);

  // Clear existing insights
  const deleted = await db.insight.deleteMany();
  console.log(`\n🗑  Cleared ${deleted.count} existing insights`);

  // Insert all
  let inserted = 0;

  for (const g of guidance) {
    await db.insight.create({
      data: {
        type: g.type,
        title: g.title,
        body: g.body,
        url: g.url,
        sectionIds: g.sectionIds,
        paragraphIds: [],
        publisher: g.publisher,
      },
    });
    inserted++;
  }

  for (const v of videos) {
    await db.insight.create({
      data: {
        type: v.type,
        title: v.title,
        body: v.body,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl,
        durationMinutes: v.durationMinutes,
        sectionIds: v.sectionIds,
        paragraphIds: [],
        publisher: v.publisher,
      },
    });
    inserted++;
  }

  for (const a of articles) {
    await db.insight.create({
      data: {
        type: a.type,
        title: a.title,
        body: a.body,
        url: a.url,
        sectionIds: a.sectionIds,
        paragraphIds: [],
        publisher: a.publisher,
      },
    });
    inserted++;
  }

  console.log(`\n✅ Inserted ${inserted} insights:`);
  console.log(`   ${guidance.length} guidance entries`);
  console.log(`   ${videos.length} videos`);
  console.log(`   ${articles.length} articles`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
