/**
 * FMCSA Guidance Comparison Tool
 *
 * Compares scraped portal data (data/scraped-guidance.json) against the
 * current Excel spreadsheet (docs/eRegs Guidance.xlsx) used to seed insights.
 *
 * Generates a human-readable comparison report at data/guidance-comparison.md.
 *
 * Usage:
 *   npx tsx scripts/compare-guidance.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const DOCS = path.join(__dirname, "..", "docs");
const DATA = path.join(__dirname, "..", "data");
const SCRAPED_FILE = path.join(DATA, "scraped-guidance.json");
const REPORT_FILE = path.join(DATA, "guidance-comparison.md");

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

interface ExcelEntry {
  section: string;
  title: string;
  body: string;
  url: string;
}

// ── Helpers ──

function cleanSection(s: string): string {
  return s.replace(/[Tt]$/, "").trim();
}

/** Normalize text for comparison */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''""]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Word set for Jaccard similarity */
function wordSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Jaccard similarity between two word sets */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Extract the "question" part from Q/A text */
function extractQuestion(qa: string): string {
  const qMatch = qa.match(/QUESTION:\s*(.*?)(?:\s*ANSWER:|$)/s);
  return qMatch ? qMatch[1].trim() : qa.substring(0, 200);
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

// ── Parse Excel ──

function parseExcel(): ExcelEntry[] {
  const filePath = path.join(DOCS, "eRegs Guidance.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found: ${filePath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });

  const entries: ExcelEntry[] = [];

  for (const row of rows) {
    const section = cleanSection(
      String(row["Section Number"] ?? row["section"] ?? "")
    );
    const qa = String(
      row["Question/Answer"] ?? row["question/answer"] ?? ""
    ).trim();
    const dotLink = String(row["DOT Link"] ?? row["dot link"] ?? "").trim();

    if (!section || !qa) continue;

    const title = extractQuestion(qa);

    entries.push({
      section,
      title,
      body: qa,
      url: dotLink,
    });
  }

  return entries;
}

// ── Matching ──

interface Match {
  excelIdx: number;
  scrapedIdx: number;
  method: "url" | "title" | "body";
  similarity: number;
}

function findMatches(
  excelEntries: ExcelEntry[],
  scrapedEntries: ScrapedEntry[]
): Match[] {
  const matches: Match[] = [];
  const matchedExcel = new Set<number>();
  const matchedScraped = new Set<number>();

  // Build URL index for scraped entries
  const scrapedByUrl = new Map<string, number>();
  scrapedEntries.forEach((e, i) => {
    if (e.url) scrapedByUrl.set(normalizeUrl(e.url), i);
  });

  // Pass 1: URL matching
  excelEntries.forEach((excel, ei) => {
    if (!excel.url || matchedExcel.has(ei)) return;
    const normalizedUrl = normalizeUrl(excel.url);
    const si = scrapedByUrl.get(normalizedUrl);
    if (si !== undefined && !matchedScraped.has(si)) {
      matches.push({ excelIdx: ei, scrapedIdx: si, method: "url", similarity: 1.0 });
      matchedExcel.add(ei);
      matchedScraped.add(si);
    }
  });

  console.log(`  URL matches: ${matches.length}`);

  // Pass 2: Title similarity within same section
  excelEntries.forEach((excel, ei) => {
    if (matchedExcel.has(ei)) return;

    const excelNorm = normalize(excel.title).substring(0, 80);
    let bestSi = -1;
    let bestSim = 0;

    scrapedEntries.forEach((scraped, si) => {
      if (matchedScraped.has(si)) return;

      // Must share a section
      const sharedSection = scraped.sectionIds.some(
        (s) => s === excel.section || s.startsWith(excel.section + ".")
      );
      if (!sharedSection && scraped.sectionIds.length > 0) return;

      const scrapedNorm = normalize(scraped.title).substring(0, 80);

      // Levenshtein-like comparison via word overlap
      const sim = jaccard(wordSet(excelNorm), wordSet(scrapedNorm));
      if (sim > bestSim && sim > 0.4) {
        bestSim = sim;
        bestSi = si;
      }
    });

    if (bestSi >= 0) {
      matches.push({
        excelIdx: ei,
        scrapedIdx: bestSi,
        method: "title",
        similarity: bestSim,
      });
      matchedExcel.add(ei);
      matchedScraped.add(bestSi);
    }
  });

  console.log(`  Title matches: ${matches.filter((m) => m.method === "title").length}`);

  // Pass 3: Body text similarity (for remaining unmatched)
  excelEntries.forEach((excel, ei) => {
    if (matchedExcel.has(ei)) return;

    const excelWords = wordSet(excel.body);
    if (excelWords.size < 5) return; // Too short to match on body

    let bestSi = -1;
    let bestSim = 0;

    scrapedEntries.forEach((scraped, si) => {
      if (matchedScraped.has(si)) return;
      if (!scraped.body) return;

      const scrapedWords = wordSet(scraped.body);
      const sim = jaccard(excelWords, scrapedWords);
      if (sim > bestSim && sim > 0.3) {
        bestSim = sim;
        bestSi = si;
      }
    });

    if (bestSi >= 0) {
      matches.push({
        excelIdx: ei,
        scrapedIdx: bestSi,
        method: "body",
        similarity: bestSim,
      });
      matchedExcel.add(ei);
      matchedScraped.add(bestSi);
    }
  });

  console.log(`  Body matches: ${matches.filter((m) => m.method === "body").length}`);

  return matches;
}

// ── Detect text differences in matched entries ──

interface TextDiff {
  excelIdx: number;
  scrapedIdx: number;
  section: string;
  title: string;
  snippets: Array<{
    context: string;
    excel: string;
    scraped: string;
  }>;
}

function findTextDifferences(
  matches: Match[],
  excelEntries: ExcelEntry[],
  scrapedEntries: ScrapedEntry[]
): TextDiff[] {
  const diffs: TextDiff[] = [];

  // Known problematic patterns to check
  const checkPatterns = [
    { pattern: /(\d+)\s*air[- ]?miles?/gi, label: "air-mile radius" },
    { pattern: /(\d+)\s*hours?/gi, label: "hours" },
    { pattern: /(\d+)\s*days?/gi, label: "days" },
    { pattern: /(\d+)\s*minutes?/gi, label: "minutes" },
    { pattern: /(\d+)\s*pounds?/gi, label: "weight" },
    { pattern: /(\d+)\s*(?:statute\s+)?miles?/gi, label: "miles" },
  ];

  for (const match of matches) {
    const excel = excelEntries[match.excelIdx];
    const scraped = scrapedEntries[match.scrapedIdx];

    if (!scraped.body) continue;

    const snippets: TextDiff["snippets"] = [];

    for (const { pattern, label } of checkPatterns) {
      const excelMatches = [...excel.body.matchAll(new RegExp(pattern))];
      const scrapedMatches = [...scraped.body.matchAll(new RegExp(pattern))];

      // Compare the values found
      const excelValues = excelMatches.map((m) => m[0].toLowerCase().trim());
      const scrapedValues = scrapedMatches.map((m) => m[0].toLowerCase().trim());

      // Find values in Excel that differ from scraped
      for (const ev of excelValues) {
        const evNorm = ev.replace(/\s+/g, " ");
        const matching = scrapedValues.some(
          (sv) => sv.replace(/\s+/g, " ") === evNorm
        );
        if (!matching && scrapedValues.length > 0) {
          snippets.push({
            context: label,
            excel: ev,
            scraped: scrapedValues[0],
          });
        }
      }
    }

    // Also check overall similarity — low similarity on matched entries is a flag
    const overallSim = jaccard(wordSet(excel.body), wordSet(scraped.body));
    if (overallSim < 0.5 && scraped.body.length > 50) {
      snippets.push({
        context: `Low text similarity (${(overallSim * 100).toFixed(0)}%)`,
        excel: excel.body.substring(0, 150) + "...",
        scraped: scraped.body.substring(0, 150) + "...",
      });
    }

    if (snippets.length > 0) {
      diffs.push({
        excelIdx: match.excelIdx,
        scrapedIdx: match.scrapedIdx,
        section: excel.section,
        title: excel.title.substring(0, 100),
        snippets,
      });
    }
  }

  return diffs;
}

// ── Generate Report ──

function generateReport(
  excelEntries: ExcelEntry[],
  scrapedEntries: ScrapedEntry[],
  matches: Match[],
  diffs: TextDiff[]
): string {
  const matchedExcelIdxs = new Set(matches.map((m) => m.excelIdx));
  const matchedScrapedIdxs = new Set(matches.map((m) => m.scrapedIdx));

  const newEntries = scrapedEntries.filter((_, i) => !matchedScrapedIdxs.has(i));
  const staleEntries = excelEntries.filter((_, i) => !matchedExcelIdxs.has(i));

  // Group by part
  const getPart = (sectionOrIds: string | string[]): string => {
    const s = Array.isArray(sectionOrIds)
      ? sectionOrIds[0] ?? "unknown"
      : sectionOrIds;
    return s.split(".")[0] || "unknown";
  };

  // Coverage by part
  const excelByPart = new Map<string, number>();
  excelEntries.forEach((e) => {
    const part = getPart(e.section);
    excelByPart.set(part, (excelByPart.get(part) ?? 0) + 1);
  });

  const scrapedByPart = new Map<string, number>();
  scrapedEntries.forEach((e) => {
    const parts = e.sectionIds.length > 0
      ? [...new Set(e.sectionIds.map((s) => s.split(".")[0]))]
      : ["unknown"];
    parts.forEach((part) => {
      scrapedByPart.set(part, (scrapedByPart.get(part) ?? 0) + 1);
    });
  });

  const allParts = [
    ...new Set([...excelByPart.keys(), ...scrapedByPart.keys()]),
  ].sort();

  // New entries by part
  const newByPart = new Map<string, ScrapedEntry[]>();
  newEntries.forEach((e) => {
    const parts = e.sectionIds.length > 0
      ? [...new Set(e.sectionIds.map((s) => s.split(".")[0]))]
      : ["unknown"];
    parts.forEach((part) => {
      if (!newByPart.has(part)) newByPart.set(part, []);
      newByPart.get(part)!.push(e);
    });
  });

  // Build report
  let report = `# FMCSA Guidance Comparison Report\n\n`;
  report += `Generated: ${new Date().toISOString().split("T")[0]}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Current (Excel) | ${excelEntries.length} entries |\n`;
  report += `| Scraped (Portal) | ${scrapedEntries.length} entries |\n`;
  report += `| Matched | ${matches.length} entries |\n`;
  report += `| New (portal only) | ${newEntries.length} entries |\n`;
  report += `| Stale (Excel only) | ${staleEntries.length} entries |\n`;
  report += `| Text differences | ${diffs.length} matched entries with changes |\n\n`;

  // Match method breakdown
  const urlMatches = matches.filter((m) => m.method === "url").length;
  const titleMatches = matches.filter((m) => m.method === "title").length;
  const bodyMatches = matches.filter((m) => m.method === "body").length;
  report += `**Match methods:** ${urlMatches} URL, ${titleMatches} title, ${bodyMatches} body\n\n`;

  // Coverage by part
  report += `## Coverage by Part\n\n`;
  report += `| Part | Excel | Portal | Delta |\n`;
  report += `|------|-------|--------|-------|\n`;
  for (const part of allParts) {
    const ec = excelByPart.get(part) ?? 0;
    const sc = scrapedByPart.get(part) ?? 0;
    const delta = sc - ec;
    const deltaStr = delta > 0 ? `+${delta}` : delta === 0 ? "—" : `${delta}`;
    report += `| ${part} | ${ec} | ${sc} | ${deltaStr} |\n`;
  }
  report += `\n`;

  // Text differences (most important for user)
  if (diffs.length > 0) {
    report += `## Text Differences (Potential Outdated Content)\n\n`;
    report += `These matched entries have numeric or content differences that may indicate outdated data in the Excel spreadsheet.\n\n`;

    for (const diff of diffs.slice(0, 50)) {
      report += `### § ${diff.section} — ${diff.title}\n\n`;
      for (const s of diff.snippets) {
        report += `- **${s.context}**\n`;
        report += `  - Excel: \`${s.excel}\`\n`;
        report += `  - Portal: \`${s.scraped}\`\n`;
      }
      report += `\n`;
    }
    if (diffs.length > 50) {
      report += `*...and ${diffs.length - 50} more*\n\n`;
    }
  }

  // New entries
  if (newEntries.length > 0) {
    report += `## New Entries (Portal Only)\n\n`;
    report += `These ${newEntries.length} entries exist on the FMCSA portal but not in the current Excel data.\n\n`;

    for (const part of [...newByPart.keys()].sort()) {
      const entries = newByPart.get(part)!;
      report += `### Part ${part} (+${entries.length} new)\n\n`;
      for (const e of entries.slice(0, 20)) {
        const sections = e.sectionIds.length > 0 ? `§ ${e.sectionIds.join(", ")}` : "no section";
        report += `- **${sections}** — ${e.title.substring(0, 100)} (${e.issuedDate || "no date"})\n`;
      }
      if (entries.length > 20) {
        report += `- *...and ${entries.length - 20} more*\n`;
      }
      report += `\n`;
    }
  }

  // Stale entries
  if (staleEntries.length > 0) {
    report += `## Stale Entries (Excel Only)\n\n`;
    report += `These ${staleEntries.length} entries exist in the Excel spreadsheet but were NOT found on the portal.\n`;
    report += `They may have been rescinded, superseded, or the URL changed.\n\n`;

    for (const e of staleEntries.slice(0, 30)) {
      report += `- **§ ${e.section}** — ${e.title.substring(0, 100)}`;
      if (e.url) report += ` ([link](${e.url}))`;
      report += `\n`;
    }
    if (staleEntries.length > 30) {
      report += `- *...and ${staleEntries.length - 30} more*\n`;
    }
    report += `\n`;
  }

  // Sample of scraped entries with body text
  const withBody = scrapedEntries.filter((e) => e.body.length > 50);
  report += `## Data Quality\n\n`;
  report += `- Entries with body text: ${withBody.length} / ${scrapedEntries.length}\n`;
  report += `- Entries with section references: ${scrapedEntries.filter((e) => e.sectionIds.length > 0).length} / ${scrapedEntries.length}\n`;
  report += `- Entries with issued date: ${scrapedEntries.filter((e) => e.issuedDate).length} / ${scrapedEntries.length}\n\n`;

  if (withBody.length > 0) {
    report += `### Sample Entry (with body)\n\n`;
    const sample = withBody[0];
    report += `- **Title:** ${sample.title}\n`;
    report += `- **Guidance ID:** ${sample.guidanceId}\n`;
    report += `- **Sections:** ${sample.sectionIds.join(", ") || "none"}\n`;
    report += `- **Date:** ${sample.issuedDate}\n`;
    report += `- **Body preview:** ${sample.body.substring(0, 300)}...\n\n`;
  }

  return report;
}

// ── Main ──

async function main() {
  console.log("=== FMCSA Guidance Comparison Tool ===\n");

  // Load scraped data
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(
      `Scraped data not found at ${SCRAPED_FILE}\nRun the scraper first: npx tsx scripts/scrape-fmcsa-guidance.ts`
    );
    process.exit(1);
  }

  const scrapedEntries: ScrapedEntry[] = JSON.parse(
    fs.readFileSync(SCRAPED_FILE, "utf-8")
  );
  console.log(`Loaded ${scrapedEntries.length} scraped entries`);

  // Load Excel data
  const excelEntries = parseExcel();
  console.log(`Loaded ${excelEntries.length} Excel entries\n`);

  // Find matches
  console.log("Finding matches...");
  const matches = findMatches(excelEntries, scrapedEntries);
  console.log(`Total matches: ${matches.length}\n`);

  // Find text differences
  console.log("Checking for text differences...");
  const diffs = findTextDifferences(matches, excelEntries, scrapedEntries);
  console.log(`Found ${diffs.length} entries with text differences\n`);

  // Generate report
  const report = generateReport(excelEntries, scrapedEntries, matches, diffs);

  // Write report
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`Report written to: ${REPORT_FILE}`);

  // Also print summary to stdout
  const lines = report.split("\n");
  const summaryEnd = lines.findIndex((l) =>
    l.startsWith("## Text Differences") || l.startsWith("## New Entries")
  );
  console.log("\n" + lines.slice(0, summaryEnd > 0 ? summaryEnd : 30).join("\n"));
}

main().catch(console.error);
