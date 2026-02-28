/**
 * Clean up FMCSA Guidance text quality
 *
 * Fixes common issues in both scraped JSON and database entries:
 *   - Non-breaking spaces (\xa0) → regular spaces
 *   - Guidance ID prefix at start of body text
 *   - Excess whitespace / blank lines
 *   - \r\n mid-sentence → single space
 *   - Leading/trailing whitespace
 *
 * Usage:
 *   npx tsx scripts/clean-guidance.ts              # clean scraped JSON + DB
 *   npx tsx scripts/clean-guidance.ts --json-only   # only clean scraped JSON
 *   npx tsx scripts/clean-guidance.ts --db-only     # only clean DB entries
 *   npx tsx scripts/clean-guidance.ts --dry-run     # show what would change
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const SCRAPED_FILE = path.join(__dirname, "..", "data", "scraped-guidance.json");

/** Clean body text — the core cleanup logic */
export function cleanBody(body: string, guidanceId?: string): string {
  if (!body) return body;

  let text = body;

  // 1. Replace non-breaking spaces with regular spaces
  text = text.replace(/\u00a0/g, " ");

  // 2. Replace zero-width spaces and other invisible chars
  text = text.replace(/[\u200b\u200c\u200d\ufeff]/g, "");

  // 3. Remove guidance ID prefix from start of body
  //    Pattern: "FMCSA-XXX-...(YYYY-MM-DD)" at the very beginning
  if (guidanceId) {
    const idBase = guidanceId.split("(")[0];
    // Remove the ID if it appears at the start (with optional whitespace/dashes)
    const escapedId = idBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp(`^\\s*${escapedId}[^\\n]*\\n*`, "i"),
      ""
    );
  }
  // Also catch generic pattern: starts with "FMCSA-" followed by ID-like text and date
  text = text.replace(
    /^\s*FMCSA-[A-Z0-9&._-]+(?:\([0-9-]+\))?[^\n]*\n*/i,
    ""
  );

  // 4. Replace \r\n with \n
  text = text.replace(/\r\n/g, "\n");

  // 5. Fix mid-sentence line breaks: if a line doesn't end with sentence-ending
  //    punctuation and the next line starts with a lowercase letter, join them
  text = text.replace(/([a-z,;])\n([a-z])/g, "$1 $2");

  // 6. Collapse multiple blank lines into at most two newlines
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");

  // 7. Remove leading blank lines
  text = text.replace(/^\s*\n+/, "");

  // 8. Collapse multiple spaces into one
  text = text.replace(/ {2,}/g, " ");

  // 9. Trim each line
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // 10. Final trim
  text = text.trim();

  return text;
}

/** Clean title text */
export function cleanTitle(title: string): string {
  if (!title) return title;

  let text = title;

  // Replace non-breaking spaces
  text = text.replace(/\u00a0/g, " ");

  // Replace zero-width spaces
  text = text.replace(/[\u200b\u200c\u200d\ufeff]/g, "");

  // Replace \r\n with space (titles should be single-line)
  text = text.replace(/\r?\n/g, " ");

  // Collapse multiple spaces
  text = text.replace(/ {2,}/g, " ");

  return text.trim();
}

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

async function cleanScrapedJson(dryRun: boolean): Promise<number> {
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.log("No scraped JSON found, skipping");
    return 0;
  }

  const entries: ScrapedEntry[] = JSON.parse(
    fs.readFileSync(SCRAPED_FILE, "utf-8")
  );
  console.log(`Loaded ${entries.length} scraped entries`);

  let titlesChanged = 0;
  let bodiesChanged = 0;

  for (const entry of entries) {
    const cleanedTitle = cleanTitle(entry.title);
    const cleanedBody = cleanBody(entry.body, entry.guidanceId);

    if (cleanedTitle !== entry.title) {
      if (dryRun && titlesChanged < 5) {
        console.log(`  Title: ${JSON.stringify(entry.title.substring(0, 60))}`);
        console.log(`      → ${JSON.stringify(cleanedTitle.substring(0, 60))}`);
      }
      titlesChanged++;
      if (!dryRun) entry.title = cleanedTitle;
    }

    if (cleanedBody !== entry.body) {
      if (dryRun && bodiesChanged < 5) {
        console.log(
          `  Body: ${JSON.stringify(entry.body.substring(0, 80))}`
        );
        console.log(
          `      → ${JSON.stringify(cleanedBody.substring(0, 80))}`
        );
      }
      bodiesChanged++;
      if (!dryRun) entry.body = cleanedBody;
    }
  }

  console.log(
    `  Titles changed: ${titlesChanged}, Bodies changed: ${bodiesChanged}`
  );

  if (!dryRun && (titlesChanged > 0 || bodiesChanged > 0)) {
    fs.writeFileSync(SCRAPED_FILE, JSON.stringify(entries, null, 2));
    console.log(`  Saved cleaned JSON`);
  }

  return titlesChanged + bodiesChanged;
}

async function cleanDatabase(dryRun: boolean): Promise<number> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  try {
    const entries = await db.insight.findMany({
      where: { type: "FMCSA_GUIDANCE" },
    });
    console.log(`Loaded ${entries.length} DB entries`);

    let titlesChanged = 0;
    let bodiesChanged = 0;

    for (const entry of entries) {
      const cleanedTitle = cleanTitle(entry.title);
      const cleanedBody = entry.body ? cleanBody(entry.body) : entry.body;

      const titleChanged = cleanedTitle !== entry.title;
      const bodyChanged = cleanedBody !== entry.body;

      if (titleChanged) {
        if (dryRun && titlesChanged < 5) {
          console.log(
            `  Title: ${JSON.stringify(entry.title.substring(0, 60))}`
          );
          console.log(
            `      → ${JSON.stringify(cleanedTitle.substring(0, 60))}`
          );
        }
        titlesChanged++;
      }

      if (bodyChanged) {
        if (dryRun && bodiesChanged < 5) {
          console.log(
            `  Body: ${JSON.stringify((entry.body ?? "").substring(0, 80))}`
          );
          console.log(
            `      → ${JSON.stringify((cleanedBody ?? "").substring(0, 80))}`
          );
        }
        bodiesChanged++;
      }

      if (!dryRun && (titleChanged || bodyChanged)) {
        await db.insight.update({
          where: { id: entry.id },
          data: {
            title: cleanedTitle,
            body: cleanedBody,
          },
        });
      }
    }

    console.log(
      `  Titles changed: ${titlesChanged}, Bodies changed: ${bodiesChanged}`
    );

    return titlesChanged + bodiesChanged;
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const jsonOnly = args.includes("--json-only");
  const dbOnly = args.includes("--db-only");

  console.log(`=== Clean FMCSA Guidance Data ===${dryRun ? " (DRY RUN)" : ""}\n`);

  let totalChanges = 0;

  if (!dbOnly) {
    console.log("--- Cleaning scraped JSON ---");
    totalChanges += await cleanScrapedJson(dryRun);
    console.log();
  }

  if (!jsonOnly) {
    console.log("--- Cleaning database entries ---");
    totalChanges += await cleanDatabase(dryRun);
    console.log();
  }

  console.log(`Total changes: ${totalChanges}${dryRun ? " (would be made)" : ""}`);

  if (!dryRun && totalChanges > 0 && !jsonOnly) {
    console.log(
      `\nIMPORTANT: Run embeddings regeneration to update search:\n  npx tsx scripts/generate-embeddings.ts`
    );
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
