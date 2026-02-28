/**
 * Enrich scraped guidance data with better section references
 *
 * Parses guidance identifiers (e.g., FMCSA-ELD-395-Q077) and titles
 * to extract CFR section references that the HTML scraper missed.
 *
 * Usage:
 *   npx tsx scripts/enrich-scraped-guidance.ts
 */

import * as fs from "fs";
import * as path from "path";

const DATA = path.join(__dirname, "..", "data");
const INPUT_FILE = path.join(DATA, "scraped-guidance.json");
const OUTPUT_FILE = INPUT_FILE; // overwrite in place

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

/** Extract section numbers from a guidance identifier string */
function extractSectionsFromId(id: string): string[] {
  const sections = new Set<string>();

  // Pattern 1: Explicit section numbers like 395.1, 382.701, 393.86
  const sectionMatches = id.matchAll(/(\d{3})\.(\d+)/g);
  for (const m of sectionMatches) {
    const part = parseInt(m[1]);
    if (part >= 325 && part <= 399) {
      sections.add(`${m[1]}.${m[2]}`);
    }
  }

  // Pattern 2: Part-only references like FMCSA-ELD-395-Q077 or FMCSA-HOS-395-FAQ
  // Match 3-digit numbers that are standalone (preceded/followed by dash or boundary)
  const partMatches = id.matchAll(/(?:^|[-_])(\d{3})(?:[-_]|$)/g);
  for (const m of partMatches) {
    const part = parseInt(m[1]);
    if (part >= 325 && part <= 399) {
      sections.add(m[1]);
    }
  }

  // Pattern 3: Topic abbreviations that map to parts
  const topicMap: Record<string, string> = {
    "HOS": "395",
    "ELD": "395",
    "D&A": "382",
    "DA": "382",
    "CLEAR": "382",
    "CDL": "383",
    "DQ": "391",
    "MED": "391",
    "INS": "387",
    "VEH": "393",
    "RG": "390",
    "ELDT": "380",
    "ACC": "390",
    "HM": "397",
    "HMSP": "385",
  };

  for (const [abbrev, part] of Object.entries(topicMap)) {
    if (id.includes(`FMCSA-${abbrev}-`) || id.includes(`FMCSA-${abbrev}_`)) {
      sections.add(part);
    }
  }

  return Array.from(sections);
}

/** Extract section numbers from title text */
function extractSectionsFromTitle(title: string): string[] {
  const sections = new Set<string>();

  // Match patterns like "§ 395.1", "Part 390", "Section 382.701", "49 CFR 395"
  const patterns = [
    /§\s*(\d{3,4}(?:\.\d+)?)/g,
    /(?:Part|Section)\s+(\d{3,4}(?:\.\d+)?)/gi,
    /49\s*C\.?F\.?R\.?\s*(?:Part\s*)?(\d{3,4}(?:\.\d+)?)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(title)) !== null) {
      const section = match[1];
      const part = parseInt(section.split(".")[0]);
      if (part >= 325 && part <= 399) {
        sections.add(section);
      }
    }
  }

  return Array.from(sections);
}

/** Extract sections from the "Regulatory Topic" field */
function extractSectionsFromTopic(topic: string): string[] {
  const sections = new Set<string>();

  // Topic field often contains text like "Hours of Service Definitions"
  // Map common topics to parts
  const topicPartMap: Record<string, string> = {
    "hours of service": "395",
    "electronic logging": "395",
    "eld": "395",
    "drug": "382",
    "alcohol": "382",
    "clearinghouse": "382",
    "commercial driver": "383",
    "cdl": "383",
    "driver qualification": "391",
    "medical": "391",
    "insurance": "387",
    "financial responsibility": "387",
    "vehicle": "393",
    "parts and accessories": "393",
    "general": "390",
    "hazardous materials": "397",
    "safety permit": "385",
    "entry-level": "380",
    "training": "380",
  };

  const topicLower = topic.toLowerCase();
  for (const [keyword, part] of Object.entries(topicPartMap)) {
    if (topicLower.includes(keyword)) {
      sections.add(part);
    }
  }

  return Array.from(sections);
}

function main() {
  console.log("=== Enriching Scraped Guidance Data ===\n");

  const entries: ScrapedEntry[] = JSON.parse(
    fs.readFileSync(INPUT_FILE, "utf-8")
  );
  console.log(`Loaded ${entries.length} entries`);

  const beforeNoSections = entries.filter((e) => e.sectionIds.length === 0).length;
  console.log(`Entries without section refs (before): ${beforeNoSections}\n`);

  let enrichedCount = 0;

  for (const entry of entries) {
    const newSections = new Set(entry.sectionIds);
    const before = newSections.size;

    // Extract from guidance ID
    for (const s of extractSectionsFromId(entry.guidanceId)) {
      newSections.add(s);
    }

    // Extract from title
    for (const s of extractSectionsFromTitle(entry.title)) {
      newSections.add(s);
    }

    // Extract from topic (listing page topic column)
    if (entry.topic) {
      for (const s of extractSectionsFromTopic(entry.topic)) {
        newSections.add(s);
      }
    }

    // Extract from Regulatory Topic detail field
    const regTopic = entry.detailFields?.["Regulatory Topic"];
    if (regTopic) {
      for (const s of extractSectionsFromTopic(regTopic)) {
        newSections.add(s);
      }
    }

    if (newSections.size > before) {
      enrichedCount++;
    }

    entry.sectionIds = Array.from(newSections).sort();
  }

  const afterNoSections = entries.filter((e) => e.sectionIds.length === 0).length;

  console.log(`Enriched ${enrichedCount} entries with new section refs`);
  console.log(`Entries without section refs (after): ${afterNoSections}`);
  console.log(`Improvement: ${beforeNoSections - afterNoSections} entries gained section refs\n`);

  // Stats by part
  const byPart = new Map<string, number>();
  for (const entry of entries) {
    const parts = entry.sectionIds.length > 0
      ? [...new Set(entry.sectionIds.map((s) => s.split(".")[0]))]
      : ["unknown"];
    for (const p of parts) {
      byPart.set(p, (byPart.get(p) ?? 0) + 1);
    }
  }

  console.log("Coverage by part:");
  for (const [part, count] of [...byPart.entries()].sort()) {
    console.log(`  Part ${part}: ${count} entries`);
  }

  // Save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2));
  console.log(`\nSaved enriched data to ${OUTPUT_FILE}`);
}

main();
