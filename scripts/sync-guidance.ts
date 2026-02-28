/**
 * Automated FMCSA Guidance Sync
 *
 * Orchestrates the full guidance pipeline:
 *   1. Scrape (incremental — only new entries)
 *   2. Enrich section references
 *   3. Import into DB (merge mode)
 *   4. Generate embeddings for new/updated entries
 *
 * Usage:
 *   npx tsx scripts/sync-guidance.ts              # full incremental sync
 *   npx tsx scripts/sync-guidance.ts --dry-run    # show what would happen
 *   npx tsx scripts/sync-guidance.ts --full       # full re-scrape (not incremental)
 *   npx tsx scripts/sync-guidance.ts --skip-scrape # skip scraping, run import + embed only
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
const SCRAPED_FILE = path.join(DATA_DIR, "scraped-guidance.json");
const LOG_FILE = path.join(DATA_DIR, "sync-guidance.log");

interface SyncResult {
  timestamp: string;
  scrapeNewEntries: number;
  scrapeTotalEntries: number;
  enriched: number;
  imported: { inserted: number; updated: number; kept: number };
  embeddingsGenerated: number;
  errors: string[];
  durationMs: number;
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function run(cmd: string, description: string): string {
  log(`Running: ${description}`);
  log(`  $ ${cmd}`);
  try {
    const output = execSync(cmd, {
      cwd: path.join(__dirname, ".."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600_000, // 10 minutes per step
    });
    // Log last few meaningful lines
    const lines = output.trim().split("\n").filter(Boolean);
    for (const line of lines.slice(-5)) {
      log(`  ${line}`);
    }
    return output;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message: string };
    const stderr = error.stderr ?? "";
    const stdout = error.stdout ?? "";
    log(`  ERROR: ${stderr || error.message}`);
    if (stdout) {
      const lines = stdout.trim().split("\n").filter(Boolean);
      for (const line of lines.slice(-3)) {
        log(`  ${line}`);
      }
    }
    throw new Error(`Step failed: ${description}\n${stderr || error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fullScrape = args.includes("--full");
  const skipScrape = args.includes("--skip-scrape");

  const startTime = Date.now();
  const result: SyncResult = {
    timestamp: new Date().toISOString(),
    scrapeNewEntries: 0,
    scrapeTotalEntries: 0,
    enriched: 0,
    imported: { inserted: 0, updated: 0, kept: 0 },
    embeddingsGenerated: 0,
    errors: [],
    durationMs: 0,
  };

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  log("=== FMCSA Guidance Sync ===");
  log(`Mode: ${dryRun ? "DRY RUN" : "live"}${fullScrape ? " (full)" : " (incremental)"}${skipScrape ? " (skip-scrape)" : ""}`);

  // Count existing entries before scrape
  let entriesBefore = 0;
  if (fs.existsSync(SCRAPED_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SCRAPED_FILE, "utf-8"));
      entriesBefore = existing.length;
      log(`Existing scraped data: ${entriesBefore} entries`);
    } catch {
      log("No valid existing scraped data");
    }
  }

  // Step 1: Scrape
  if (!skipScrape) {
    log("\n--- Step 1: Scrape FMCSA Guidance Portal ---");
    try {
      const scrapeFlags = fullScrape ? "" : "--incremental";
      const output = run(
        `npx tsx scripts/scrape-fmcsa-guidance.ts ${scrapeFlags}`,
        "FMCSA guidance scraper"
      );

      // Parse output for stats
      const totalMatch = output.match(/Total entries:\s*(\d+)/);
      if (totalMatch) {
        result.scrapeTotalEntries = parseInt(totalMatch[1]);
        result.scrapeNewEntries = result.scrapeTotalEntries - entriesBefore;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Scrape failed: ${msg}`);
      log(`Scrape failed, continuing with existing data...`);
    }
  } else {
    log("\n--- Step 1: Skipping scrape ---");
    result.scrapeTotalEntries = entriesBefore;
  }

  // Step 2: Enrich section references
  if (fs.existsSync(SCRAPED_FILE)) {
    log("\n--- Step 2: Enrich section references ---");
    try {
      const output = run(
        "npx tsx scripts/enrich-scraped-guidance.ts",
        "Section enrichment"
      );
      const enrichMatch = output.match(/Enriched (\d+) entries/);
      if (enrichMatch) {
        result.enriched = parseInt(enrichMatch[1]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Enrichment failed: ${msg}`);
      log(`Enrichment failed, continuing with unenriched data...`);
    }
  }

  // Step 3: Import into database
  if (fs.existsSync(SCRAPED_FILE)) {
    log("\n--- Step 3: Import into database ---");
    try {
      if (dryRun) {
        const output = run(
          "npx tsx scripts/import-scraped-guidance.ts --dry-run",
          "Import (dry run)"
        );
        const newMatch = output.match(/New entries to insert:\s*(\d+)/);
        const updateMatch = output.match(/Matched entries to update:\s*(\d+)/);
        if (newMatch) result.imported.inserted = parseInt(newMatch[1]);
        if (updateMatch) result.imported.updated = parseInt(updateMatch[1]);
      } else {
        const output = run(
          "npx tsx scripts/import-scraped-guidance.ts --mode=merge",
          "Import (merge mode)"
        );
        const insertMatch = output.match(/(\d+) inserted/);
        const updateMatch = output.match(/(\d+) updated/);
        const deleteMatch = output.match(/(\d+) deleted/);
        if (insertMatch) result.imported.inserted = parseInt(insertMatch[1]);
        if (updateMatch) result.imported.updated = parseInt(updateMatch[1]);
        if (deleteMatch) result.imported.kept = parseInt(deleteMatch[1]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Import failed: ${msg}`);
    }
  } else {
    log("No scraped data found, skipping import");
  }

  // Step 4: Generate embeddings for new/changed entries
  if (!dryRun && (result.imported.inserted > 0 || result.imported.updated > 0)) {
    log("\n--- Step 4: Generate embeddings ---");
    try {
      const output = run(
        "npx tsx scripts/generate-embeddings.ts",
        "Embedding generation"
      );
      const totalMatch = output.match(/(\d+) total chunks/);
      if (totalMatch) {
        result.embeddingsGenerated = parseInt(totalMatch[1]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Embedding generation failed: ${msg}`);
    }
  } else if (dryRun) {
    log("\n--- Step 4: Skipping embeddings (dry run) ---");
  } else {
    log("\n--- Step 4: Skipping embeddings (no changes) ---");
  }

  // Summary
  result.durationMs = Date.now() - startTime;

  log("\n=== Sync Complete ===");
  log(`Duration: ${Math.round(result.durationMs / 1000)}s`);
  log(`Scraped: ${result.scrapeNewEntries} new entries (${result.scrapeTotalEntries} total)`);
  log(`Enriched: ${result.enriched} entries`);
  log(`Imported: ${result.imported.inserted} inserted, ${result.imported.updated} updated`);
  if (result.embeddingsGenerated > 0) {
    log(`Embeddings: ${result.embeddingsGenerated} chunks`);
  }
  if (result.errors.length > 0) {
    log(`Errors: ${result.errors.length}`);
    for (const err of result.errors) {
      log(`  - ${err.substring(0, 200)}`);
    }
  }

  // Save result to log file as JSON for programmatic access
  const resultFile = path.join(DATA_DIR, "sync-guidance-result.json");
  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  log(`Result saved to ${resultFile}`);

  // Exit with error code if there were critical failures
  if (result.errors.some((e) => e.includes("Import failed"))) {
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Fatal error: ${err}`);
  process.exit(1);
});
