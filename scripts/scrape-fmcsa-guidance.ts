/**
 * FMCSA Guidance Portal Scraper
 *
 * Scrapes https://www.fmcsa.dot.gov/guidance (all pages) using Playwright.
 * Akamai CDN blocks headless browsers, so we use headed mode with
 * anti-automation flags and a realistic User-Agent.
 *
 * Output: data/scraped-guidance.json
 *
 * Usage:
 *   npx tsx scripts/scrape-fmcsa-guidance.ts
 *   npx tsx scripts/scrape-fmcsa-guidance.ts --start=50   # resume from page 50
 *   npx tsx scripts/scrape-fmcsa-guidance.ts --headless    # try headless (may 403)
 *   npx tsx scripts/scrape-fmcsa-guidance.ts --incremental # only scrape new entries
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://www.fmcsa.dot.gov";
const GUIDANCE_URL = `${BASE_URL}/guidance`;
const OUTPUT_FILE = path.join(__dirname, "..", "data", "scraped-guidance.json");
const PROGRESS_FILE = path.join(__dirname, "..", "data", "scrape-progress.json");

// Rate limits
const DELAY_BETWEEN_LIST_PAGES = 2000; // 2s between listing pages
const DELAY_BETWEEN_DETAIL_PAGES = 500; // 500ms between detail pages
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE = 3000; // 3s, 6s, 9s

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

interface Progress {
  lastCompletedPage: number;
  entries: ScrapedEntry[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract CFR section references from text like "49 CFR 395.1" → "395.1" */
function extractSectionIds(text: string): string[] {
  const sectionSet = new Set<string>();

  // Match patterns like "49 CFR 395.1", "§ 395.1", "Section 395.1", "Part 395"
  const patterns = [
    /(?:49\s*C\.?F\.?R\.?\s*(?:Part\s*)?|§\s*|Section\s+)(\d{3,4}(?:\.\d+)?)/gi,
    /Part\s+(\d{3,4})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const section = match[1];
      // Only include valid FMCSR part ranges (300-399 series)
      const partNum = parseInt(section.split(".")[0]);
      if (partNum >= 300 && partNum <= 399) {
        sectionSet.add(section);
      }
    }
  }

  return Array.from(sectionSet).sort();
}

/** Parse the guidance identifier to extract date and status hints */
function parseGuidanceId(id: string): { date: string | null } {
  // Format: FMCSA-HOS-395.1-FAQ01(2020-09-29)
  const dateMatch = id.match(/\((\d{4}-\d{2}-\d{2})\)/);
  return {
    date: dateMatch ? dateMatch[1] : null,
  };
}

/** Scrape all entries from a single listing page */
async function scrapeListingPage(
  page: Page,
  pageNum: number
): Promise<Array<{ title: string; link: string; guidanceId: string; topic: string; issuedDate: string }>> {
  const url = `${GUIDANCE_URL}?page=${pageNum}`;
  console.log(`  [Page ${pageNum}] Loading ${url}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".views-table tbody tr", { timeout: 15000 });

  const rows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll(".views-table tbody tr"));
    return trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      const linkEl = tds[0]?.querySelector("a");
      return {
        title: tds[0]?.textContent?.trim() ?? "",
        link: linkEl?.getAttribute("href") ?? "",
        guidanceId: tds[1]?.textContent?.trim() ?? "",
        topic: tds[2]?.textContent?.trim() ?? "",
        issuedDate: tds[3]?.textContent?.trim() ?? "",
      };
    });
  });

  console.log(`  [Page ${pageNum}] Found ${rows.length} entries`);
  return rows;
}

/** Scrape detail fields from a single guidance detail page */
async function scrapeDetailPage(
  page: Page,
  detailUrl: string
): Promise<{ body: string; fields: Record<string, string>; sectionIds: string[] }> {
  const fullUrl = detailUrl.startsWith("http") ? detailUrl : `${BASE_URL}${detailUrl}`;
  await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  const result = await page.evaluate(() => {
    // The FMCSA Drupal site renders Q&A content inside <div class="my-4"> blocks
    // within the article. The .field--name-body element exists but is often empty;
    // the actual styled content is in sibling <div class="my-4"> elements.
    let body = "";

    // Strategy 1: Get all .my-4 content blocks inside the article (primary content area)
    const contentBlocks = document.querySelectorAll("article .my-4");
    if (contentBlocks.length > 0) {
      body = Array.from(contentBlocks)
        .map((el) => el.textContent?.trim() ?? "")
        .filter((t) => t.length > 10)
        .join("\n\n");
    }

    // Strategy 2: Fall back to article text content (minus the header/nav noise)
    if (!body || body.length < 30) {
      const article = document.querySelector("article .node__content");
      if (article) {
        body = article.textContent?.trim() ?? "";
      }
    }

    // Strategy 3: #block-fmcsa-content
    if (!body || body.length < 30) {
      const block = document.querySelector("#block-fmcsa-content .content");
      if (block) {
        body = block.textContent?.trim() ?? "";
      }
    }

    // Clean up: remove "Search FMCSA" header noise
    body = body
      .replace(/^Search FMCSA\s*Search DOT\s*Search/i, "")
      .replace(/FMCSA Information Line[\s\S]*?United States/i, "")
      .trim();

    // Get all labeled fields
    const fields: Record<string, string> = {};
    const fieldEls = document.querySelectorAll(".field");
    fieldEls.forEach((f) => {
      const label = f.querySelector(".field__label")?.textContent?.trim();
      const value = f.querySelector(".field__item, .field__items")?.textContent?.trim();
      if (label && value) {
        fields[label] = value.substring(0, 2000);
      }
    });

    // Also get the Regulatory Topic field specifically
    const topicEl = document.querySelector(".field--name-field-regulatory-topic");
    if (topicEl) {
      const topicText = topicEl.textContent?.replace("Regulatory Topic:", "").trim();
      if (topicText) fields["Regulatory Topic"] = topicText;
    }

    // Grab the full page text for section extraction
    const mainContent = document.querySelector("main, #block-fmcsa-content, .region-content");
    const fullText = mainContent?.textContent ?? "";

    return { body: body.substring(0, 10000), fields, fullText: fullText.substring(0, 15000) };
  });

  const sectionIds = extractSectionIds(result.fullText);

  return {
    body: result.body,
    fields: result.fields,
    sectionIds,
  };
}

/** Normalize URL to path for comparison */
function normalizeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, "");
  }
}

/** Save progress to allow resume */
function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/** Load previous progress if exists */
function loadProgress(): Progress | null {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const startPageArg = args.find((a) => a.startsWith("--start="));
  const useHeadless = args.includes("--headless");
  const skipDetails = args.includes("--skip-details");
  const listOnly = args.includes("--list-only");
  const incremental = args.includes("--incremental");

  // In incremental mode, load existing scraped data as the baseline
  let existingData: ScrapedEntry[] = [];
  const existingUrlSet = new Set<string>();
  if (incremental && fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      for (const e of existingData) {
        if (e.url) existingUrlSet.add(normalizeUrlPath(e.url));
      }
      console.log(`Incremental mode: loaded ${existingData.length} existing entries (${existingUrlSet.size} unique URLs)`);
    } catch {
      console.warn("Could not load existing data, running full scrape");
    }
  }

  // Try to resume from progress file
  let progress = loadProgress();
  let startPage = startPageArg ? parseInt(startPageArg.split("=")[1]) : 0;

  if (progress && !startPageArg && !incremental) {
    startPage = progress.lastCompletedPage + 1;
    console.log(
      `Resuming from page ${startPage} (${progress.entries.length} entries already scraped)`
    );
  } else if (!incremental) {
    progress = { lastCompletedPage: -1, entries: [] };
  } else {
    // In incremental mode, start fresh progress but will merge with existing at the end
    progress = { lastCompletedPage: -1, entries: [] };
  }

  console.log(`\n=== FMCSA Guidance Portal Scraper ===`);
  console.log(`Mode: ${useHeadless ? "headless" : "headed"}${incremental ? " (incremental)" : ""}`);
  console.log(`Starting from page: ${startPage}`);
  if (skipDetails || listOnly) console.log(`Skipping detail pages`);
  console.log("");

  const browser = await chromium.launch({
    headless: useHeadless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    // First, determine max pages by loading the first page
    console.log("Determining total pages...");
    await page.goto(`${GUIDANCE_URL}?page=0`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForSelector(".views-table", { timeout: 15000 });

    // Find the last page number from the pager
    const maxPage = await page.evaluate(() => {
      const lastLink = document.querySelector(
        ".pager__item--last a, a[title='Go to last page']"
      );
      if (lastLink) {
        const href = lastLink.getAttribute("href") ?? "";
        const match = href.match(/page=(\d+)/);
        return match ? parseInt(match[1]) : 132;
      }
      // Fallback: find highest page number in pager links
      const links = Array.from(document.querySelectorAll("a[href*='page=']"));
      let max = 0;
      links.forEach((a) => {
        const m = a.getAttribute("href")?.match(/page=(\d+)/);
        if (m) max = Math.max(max, parseInt(m[1]));
      });
      return max || 132;
    });
    console.log(`Total pages: ${maxPage + 1} (0–${maxPage})\n`);

    // Phase 1: Scrape all listing pages
    console.log("=== Phase 1: Scraping listing pages ===\n");

    type ListingEntry = {
      title: string;
      link: string;
      guidanceId: string;
      topic: string;
      issuedDate: string;
    };
    const allListings: ListingEntry[] = [];

    // Collect listings from progress
    if (progress.entries.length > 0 && !listOnly) {
      console.log(`Using ${progress.entries.length} entries from previous run`);
    }

    // In incremental mode, track consecutive "all known" pages for early stop
    let consecutiveKnownPages = 0;
    const INCREMENTAL_STOP_THRESHOLD = 2; // Stop after 2 consecutive all-known pages

    for (let pageNum = startPage; pageNum <= maxPage; pageNum++) {
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          const entries = await scrapeListingPage(page, pageNum);
          allListings.push(...entries);
          success = true;

          // Incremental mode: check if all entries on this page are already known
          if (incremental && existingUrlSet.size > 0) {
            const knownCount = entries.filter((e) => {
              const url = e.link.startsWith("http") ? e.link : `${BASE_URL}${e.link}`;
              return existingUrlSet.has(normalizeUrlPath(url));
            }).length;

            if (knownCount === entries.length && entries.length > 0) {
              consecutiveKnownPages++;
              console.log(`  [Page ${pageNum}] All ${entries.length} entries already known (${consecutiveKnownPages}/${INCREMENTAL_STOP_THRESHOLD} pages)`);
            } else {
              consecutiveKnownPages = 0;
              const newCount = entries.length - knownCount;
              console.log(`  [Page ${pageNum}] Found ${newCount} new entries`);
            }
          }

          // Save listing progress
          if (listOnly) {
            progress.lastCompletedPage = pageNum;
            progress.entries.push(
              ...entries.map((e) => ({
                title: e.title,
                body: "",
                url: e.link.startsWith("http") ? e.link : `${BASE_URL}${e.link}`,
                guidanceId: e.guidanceId,
                topic: e.topic,
                issuedDate: e.issuedDate,
                sectionIds: extractSectionIds(`${e.title} ${e.guidanceId}`),
                status: "active",
                detailFields: {},
              }))
            );
            saveProgress(progress);
          }
        } catch (err) {
          retries++;
          const delay = RETRY_BACKOFF_BASE * retries;
          console.error(
            `  [Page ${pageNum}] Error (attempt ${retries}/${MAX_RETRIES}): ${err instanceof Error ? err.message : err}`
          );
          if (retries < MAX_RETRIES) {
            console.log(`  Retrying in ${delay / 1000}s...`);
            await sleep(delay);
          }
        }
      }

      if (!success) {
        console.error(`  [Page ${pageNum}] Failed after ${MAX_RETRIES} retries, skipping`);
      }

      // Incremental early stop
      if (incremental && consecutiveKnownPages >= INCREMENTAL_STOP_THRESHOLD) {
        console.log(`\nIncremental: stopping after ${consecutiveKnownPages} consecutive all-known pages (page ${pageNum})`);
        break;
      }

      // Rate limit between listing pages
      if (pageNum < maxPage) {
        await sleep(DELAY_BETWEEN_LIST_PAGES);
      }
    }

    console.log(`\nTotal listings scraped: ${allListings.length}\n`);

    if (listOnly) {
      // Save final output with listing data only
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(progress.entries, null, 2));
      console.log(`Saved ${progress.entries.length} entries to ${OUTPUT_FILE}`);
      await browser.close();
      return;
    }

    // Phase 2: Scrape detail pages
    if (!skipDetails) {
      console.log("=== Phase 2: Scraping detail pages ===\n");

      // In incremental mode, also skip URLs from existing data file
      const existingUrls = new Set(progress.entries.map((e) => e.url));
      if (incremental) {
        for (const e of existingData) {
          existingUrls.add(e.url);
        }
      }
      let detailCount = 0;
      const totalDetails = allListings.filter(
        (e) => e.link && !existingUrls.has(e.link.startsWith("http") ? e.link : `${BASE_URL}${e.link}`)
      ).length;

      for (const listing of allListings) {
        if (!listing.link) continue;

        const fullUrl = listing.link.startsWith("http")
          ? listing.link
          : `${BASE_URL}${listing.link}`;

        // Skip if already scraped
        if (existingUrls.has(fullUrl)) continue;

        detailCount++;
        console.log(
          `  [${detailCount}/${totalDetails}] ${listing.title.substring(0, 60)}...`
        );

        let retries = 0;
        let detail: { body: string; fields: Record<string, string>; sectionIds: string[] } | null = null;

        while (retries < MAX_RETRIES && !detail) {
          try {
            detail = await scrapeDetailPage(page, listing.link);
          } catch (err) {
            retries++;
            const delay = RETRY_BACKOFF_BASE * retries;
            console.error(
              `    Error (attempt ${retries}/${MAX_RETRIES}): ${err instanceof Error ? err.message : err}`
            );
            if (retries < MAX_RETRIES) {
              console.log(`    Retrying in ${delay / 1000}s...`);
              await sleep(delay);
            }
          }
        }

        const parsedId = parseGuidanceId(listing.guidanceId);

        // Also extract sections from the guidance ID and title
        const idSections = extractSectionIds(
          `${listing.guidanceId} ${listing.title}`
        );

        const entry: ScrapedEntry = {
          title: listing.title,
          body: detail?.body ?? "",
          url: fullUrl,
          guidanceId: listing.guidanceId,
          topic: listing.topic,
          issuedDate: listing.issuedDate || parsedId.date || "",
          sectionIds: [
            ...new Set([...(detail?.sectionIds ?? []), ...idSections]),
          ].sort(),
          status: "active",
          detailFields: detail?.fields ?? {},
        };

        progress.entries.push(entry);
        existingUrls.add(fullUrl);

        // Save progress every 10 entries
        if (detailCount % 10 === 0) {
          saveProgress(progress);
          console.log(`  [Progress saved: ${progress.entries.length} entries]`);
        }

        await sleep(DELAY_BETWEEN_DETAIL_PAGES);
      }
    } else {
      // Convert listings to entries without detail
      for (const listing of allListings) {
        const fullUrl = listing.link.startsWith("http")
          ? listing.link
          : `${BASE_URL}${listing.link}`;

        const parsedId = parseGuidanceId(listing.guidanceId);
        const idSections = extractSectionIds(
          `${listing.guidanceId} ${listing.title}`
        );

        progress.entries.push({
          title: listing.title,
          body: "",
          url: fullUrl,
          guidanceId: listing.guidanceId,
          topic: listing.topic,
          issuedDate: listing.issuedDate || parsedId.date || "",
          sectionIds: idSections,
          status: "active",
          detailFields: {},
        });
      }
    }

    // Save final output
    let finalEntries: ScrapedEntry[];
    if (incremental && existingData.length > 0) {
      // Merge: new entries + existing entries (dedup by URL)
      const urlMap = new Map<string, ScrapedEntry>();
      for (const e of existingData) {
        urlMap.set(normalizeUrlPath(e.url), e);
      }
      // New entries override existing ones (in case of updates)
      for (const e of progress.entries) {
        urlMap.set(normalizeUrlPath(e.url), e);
      }
      finalEntries = Array.from(urlMap.values());
      console.log(`\nIncremental merge: ${progress.entries.length} new/updated + ${existingData.length} existing → ${finalEntries.length} total`);
    } else {
      finalEntries = progress.entries;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalEntries, null, 2));
    console.log(`\n=== Done! ===`);
    console.log(`Total entries: ${finalEntries.length}`);
    console.log(`Output: ${OUTPUT_FILE}`);

    // Cleanup progress file
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log(`Progress file cleaned up`);
    }

    // Stats
    const withBody = finalEntries.filter((e) => e.body.length > 0).length;
    const withSections = finalEntries.filter(
      (e) => e.sectionIds.length > 0
    ).length;
    const uniqueSections = new Set(finalEntries.flatMap((e) => e.sectionIds));
    console.log(`\nStats:`);
    console.log(`  Entries with body text: ${withBody}`);
    console.log(`  Entries with section refs: ${withSections}`);
    console.log(
      `  Unique sections referenced: ${uniqueSections.size} (${Array.from(uniqueSections).slice(0, 10).join(", ")}...)`
    );
  } catch (err) {
    console.error("Fatal error:", err);
    // Save whatever we have
    if (progress.entries.length > 0) {
      saveProgress(progress);
      console.log(
        `Progress saved (${progress.entries.length} entries). Resume with: npx tsx scripts/scrape-fmcsa-guidance.ts`
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
