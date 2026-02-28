/**
 * Import Scraped FMCSA Guidance into the Insight table
 *
 * Reads data/scraped-guidance.json and imports entries as FMCSA_GUIDANCE insights.
 * Run ONLY after reviewing the comparison report (data/guidance-comparison.md).
 *
 * Modes:
 *   --mode=replace    Delete ALL FMCSA_GUIDANCE insights, import scraped (clean slate)
 *   --mode=merge      Add new entries, update changed, keep unmatched Excel entries
 *   --mode=new-only   Only add entries that don't exist in current data
 *   --dry-run         Show what would happen, write nothing
 *
 * Usage:
 *   npx tsx scripts/import-scraped-guidance.ts --dry-run
 *   npx tsx scripts/import-scraped-guidance.ts --mode=replace
 *   npx tsx scripts/import-scraped-guidance.ts --mode=merge
 *   npx tsx scripts/import-scraped-guidance.ts --mode=new-only
 *
 * After import, re-generate embeddings:
 *   npx tsx scripts/generate-embeddings.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import { cleanTitle, cleanBody } from "./clean-guidance";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const SCRAPED_FILE = path.join(__dirname, "..", "data", "scraped-guidance.json");

interface ScrapedEntry {
  title: string;
  body: string;
  url: string;
  guidanceId: string;
  topic: string;
  issuedDate: string;
  sectionIds: string[];
  status: string;
  detailFields: Record<string, string>;
}

/** Clean section IDs — strip trailing T suffix, validate format */
function cleanSectionIds(ids: string[]): string[] {
  return ids
    .map((s) => s.replace(/[Tt]$/, "").trim())
    .filter((s) => /^\d{3,4}(\.\d+)?$/.test(s));
}

/** Build a title from scraped entry (extract question if Q/A format) */
function buildTitle(entry: ScrapedEntry): string {
  // Clean body first for better Q/A extraction
  const body = cleanBody(entry.body, entry.guidanceId);

  // If body has Q/A format, extract question
  const qMatch = body.match(
    /(?:QUESTION|Q)[:.]?\s*(.*?)(?:\s*(?:ANSWER|A)[:.]|$)/si
  );
  if (qMatch && qMatch[1].trim().length > 10) {
    let title = cleanTitle(qMatch[1].trim());
    if (title.length > 120) {
      title = title.slice(0, 120).replace(/\s+\S*$/, "") + "...";
    }
    return title;
  }

  // Otherwise use the scraped title
  let title = cleanTitle(entry.title);
  if (title.length > 120) {
    title = title.slice(0, 120).replace(/\s+\S*$/, "") + "...";
  }
  return title;
}

/** Clean body text for DB storage */
function buildBody(entry: ScrapedEntry): string | null {
  if (!entry.body) return null;
  return cleanBody(entry.body, entry.guidanceId) || null;
}

/** Parse issued date string to Date */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first (2020-09-29)
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);

  // Try MM/DD/YYYY
  const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch)
    return new Date(
      `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`
    );

  // Try Month DD, YYYY
  const longMatch = dateStr.match(
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
  );
  if (longMatch) {
    const d = new Date(`${longMatch[1]} ${longMatch[2]}, ${longMatch[3]}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/** Normalize URL for comparison */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, "");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const mode = modeArg ? modeArg.split("=")[1] : null;

  if (!dryRun && !mode) {
    console.error(
      "Usage: npx tsx scripts/import-scraped-guidance.ts --mode=replace|merge|new-only [--dry-run]"
    );
    console.error("  --dry-run     Show what would happen, write nothing");
    console.error("  --mode=replace  Delete all FMCSA_GUIDANCE, import scraped");
    console.error("  --mode=merge    Add new, update changed, keep unmatched");
    console.error("  --mode=new-only Only add entries not in current data");
    process.exit(1);
  }

  if (!dryRun && !["replace", "merge", "new-only"].includes(mode!)) {
    console.error(`Invalid mode: ${mode}. Use replace, merge, or new-only.`);
    process.exit(1);
  }

  // Load scraped data
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(
      `Scraped data not found: ${SCRAPED_FILE}\nRun the scraper first: npx tsx scripts/scrape-fmcsa-guidance.ts`
    );
    process.exit(1);
  }

  const scraped: ScrapedEntry[] = JSON.parse(
    fs.readFileSync(SCRAPED_FILE, "utf-8")
  );
  console.log(`Loaded ${scraped.length} scraped entries\n`);

  // Filter to entries with useful content
  const validEntries = scraped.filter(
    (e) =>
      e.title &&
      e.sectionIds.length > 0 &&
      (e.body.length > 20 || e.title.length > 10)
  );
  console.log(
    `Valid entries (have title + section refs): ${validEntries.length}`
  );

  const skipped = scraped.length - validEntries.length;
  if (skipped > 0) {
    console.log(
      `Skipping ${skipped} entries without section references or content\n`
    );
  }

  // Get current FMCSA_GUIDANCE insights
  const existingGuidance = await db.insight.findMany({
    where: { type: "FMCSA_GUIDANCE" },
  });
  console.log(`Current FMCSA_GUIDANCE insights in DB: ${existingGuidance.length}\n`);

  // Build URL index of existing
  const existingByUrl = new Map<string, (typeof existingGuidance)[0]>();
  existingGuidance.forEach((e) => {
    if (e.url) existingByUrl.set(normalizeUrl(e.url), e);
  });

  // Categorize scraped entries
  let toInsert: ScrapedEntry[] = [];
  let toUpdate: Array<{ existing: (typeof existingGuidance)[0]; scraped: ScrapedEntry }> = [];
  const matched = new Set<string>();

  for (const entry of validEntries) {
    const normalizedUrl = entry.url ? normalizeUrl(entry.url) : "";
    const existing = normalizedUrl ? existingByUrl.get(normalizedUrl) : undefined;

    if (existing) {
      matched.add(existing.id);
      // Check if content differs
      const titleChanged = existing.title !== buildTitle(entry);
      const bodyChanged =
        entry.body && existing.body !== buildBody(entry);
      const sectionsChanged =
        JSON.stringify(existing.sectionIds.sort()) !==
        JSON.stringify(cleanSectionIds(entry.sectionIds).sort());

      if (titleChanged || bodyChanged || sectionsChanged) {
        toUpdate.push({ existing, scraped: entry });
      }
    } else {
      toInsert.push(entry);
    }
  }

  const unmatched = existingGuidance.filter((e) => !matched.has(e.id));

  console.log(`=== Import Plan (${dryRun ? "DRY RUN" : `mode: ${mode}`}) ===\n`);
  console.log(`  New entries to insert: ${toInsert.length}`);
  console.log(`  Matched entries to update: ${toUpdate.length}`);
  console.log(`  Unmatched existing entries: ${unmatched.length}`);

  if (mode === "replace") {
    console.log(
      `\n  MODE: REPLACE — will delete ALL ${existingGuidance.length} existing FMCSA_GUIDANCE and insert ${validEntries.length} scraped entries`
    );
  } else if (mode === "merge") {
    console.log(
      `\n  MODE: MERGE — will insert ${toInsert.length} new, update ${toUpdate.length} changed, keep ${unmatched.length} unmatched`
    );
  } else if (mode === "new-only") {
    console.log(
      `\n  MODE: NEW-ONLY — will insert ${toInsert.length} new entries only`
    );
    toUpdate = []; // Don't update in new-only mode
  }

  if (dryRun) {
    console.log("\n--- DRY RUN: No changes made ---\n");

    if (toInsert.length > 0) {
      console.log("Sample new entries:");
      for (const e of toInsert.slice(0, 5)) {
        console.log(
          `  + [${cleanSectionIds(e.sectionIds).join(", ")}] ${buildTitle(e).substring(0, 80)}`
        );
      }
      if (toInsert.length > 5) console.log(`  ... and ${toInsert.length - 5} more`);
    }

    if (toUpdate.length > 0) {
      console.log("\nSample updates:");
      for (const { existing, scraped } of toUpdate.slice(0, 5)) {
        console.log(
          `  ~ [${existing.sectionIds.join(", ")}] ${existing.title.substring(0, 60)} → ${buildTitle(scraped).substring(0, 60)}`
        );
      }
    }

    if (unmatched.length > 0 && mode === "replace") {
      console.log("\nSample entries that will be deleted (replace mode):");
      for (const e of unmatched.slice(0, 5)) {
        console.log(
          `  - [${e.sectionIds.join(", ")}] ${e.title.substring(0, 80)}`
        );
      }
    }

    await db.$disconnect();
    return;
  }

  // Execute import
  console.log("\nExecuting import...\n");

  let inserted = 0;
  let updated = 0;
  let deleted = 0;

  if (mode === "replace") {
    // Delete all existing FMCSA_GUIDANCE
    const result = await db.insight.deleteMany({
      where: { type: "FMCSA_GUIDANCE" },
    });
    deleted = result.count;
    console.log(`  Deleted ${deleted} existing FMCSA_GUIDANCE insights`);

    // Insert all valid scraped entries
    for (const entry of validEntries) {
      const publishedAt = parseDate(entry.issuedDate);
      await db.insight.create({
        data: {
          type: "FMCSA_GUIDANCE",
          title: buildTitle(entry),
          body: buildBody(entry),
          url: entry.url || null,
          sectionIds: cleanSectionIds(entry.sectionIds),
          paragraphIds: [],
          publisher: "FMCSA",
          publishedAt,
        },
      });
      inserted++;
      if (inserted % 50 === 0) {
        process.stdout.write(`  Inserted ${inserted}/${validEntries.length}\r`);
      }
    }
    console.log(`  Inserted ${inserted} new FMCSA_GUIDANCE insights`);
  } else if (mode === "merge" || mode === "new-only") {
    // Insert new entries
    for (const entry of toInsert) {
      const publishedAt = parseDate(entry.issuedDate);
      await db.insight.create({
        data: {
          type: "FMCSA_GUIDANCE",
          title: buildTitle(entry),
          body: buildBody(entry),
          url: entry.url || null,
          sectionIds: cleanSectionIds(entry.sectionIds),
          paragraphIds: [],
          publisher: "FMCSA",
          publishedAt,
        },
      });
      inserted++;
      if (inserted % 50 === 0) {
        process.stdout.write(`  Inserted ${inserted}/${toInsert.length}\r`);
      }
    }
    console.log(`  Inserted ${inserted} new entries`);

    // Update changed entries (merge mode only)
    if (mode === "merge") {
      for (const { existing, scraped } of toUpdate) {
        const publishedAt = parseDate(scraped.issuedDate);
        await db.insight.update({
          where: { id: existing.id },
          data: {
            title: buildTitle(scraped),
            body: buildBody(scraped) || existing.body,
            url: scraped.url || existing.url,
            sectionIds: cleanSectionIds(scraped.sectionIds),
            publishedAt: publishedAt || existing.publishedAt,
          },
        });
        updated++;
      }
      console.log(`  Updated ${updated} existing entries`);
    }
  }

  console.log(
    `\n  Done! ${inserted} inserted, ${updated} updated, ${deleted} deleted`
  );
  console.log(
    `\n  IMPORTANT: Run embeddings regeneration:\n  npx tsx scripts/generate-embeddings.ts`
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
