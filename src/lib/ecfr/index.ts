import { db } from "@/lib/db";

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = "49";
const FALLBACK_DATE = "2026-02-19";

// ── TYPES ────────────────────────────────────────────────────────────────────

export interface EcfrSection {
  part: string;
  section: string;
  title: string;
  content: EcfrNode[];
  subpartLabel?: string;
  subpartTitle?: string;
}

export interface EcfrNode {
  id: string;
  type: "paragraph" | "table" | "image" | "heading";
  label?: string;
  text: string;
  level: number;
  headingLevel?: number;  // 1, 2, or 3 for HD1/HD2/HD3
  tableHeaders?: string[];
  tableRows?: string[][];
  imageSrc?: string;
  imageCaption?: string;
}

export interface TocEntry {
  section: string;
  title: string;
  isAppendix?: boolean;  // true for appendix entries
}

export interface PartToc {
  part: string;
  title: string;
  subparts: {
    label: string;
    title: string;
    sections: TocEntry[];
  }[];
}

/** Parse a section slug like "390.5" or "385-appA" into part + section */
export function parseSectionSlug(slug: string): { part: string; section: string } | null {
  // Appendix: "385-appA", "395-appA-subB"
  const appMatch = slug.match(/^(\d+)-app(.+)$/);
  if (appMatch) return { part: appMatch[1], section: slug };
  // Section: "390.5"
  const match = slug.match(/^(\d+)\.(.+)$/);
  if (!match) return null;
  return { part: match[1], section: slug };
}

/** Check if a section identifier is an appendix */
export function isAppendixSection(section: string): boolean {
  return section.includes("-app");
}

/** Convert eCFR appendix identifier to our slug format
 *  e.g. "Appendix A to Part 385" → "385-appA"
 *       "Appendix A to Subpart B of Part 395" → "395-appA-subB"
 */
export function appendixToSlug(identifier: string, part: string): string {
  // The eCFR identifier format varies. Common patterns:
  //   "Appendix A to Part 385"
  //   "Appendix A to Subpart B of Part 395"
  // We normalize to: "{part}-app{letter}" or "{part}-app{letter}-sub{letter}"
  const m = identifier.match(/Appendix\s+(\S+)/i);
  const letter = m ? m[1] : identifier;
  const subMatch = identifier.match(/Subpart\s+(\S+)/i);
  if (subMatch) {
    return `${part}-app${letter}-sub${subMatch[1]}`;
  }
  return `${part}-app${letter}`;
}

/** Convert our appendix slug back to eCFR API query parameter
 *  e.g. "385-appA" → "Appendix A to Part 385"
 */
export function slugToAppendixIdentifier(slug: string): string | null {
  const m = slug.match(/^(\d+)-app(\S+?)(?:-sub(\S+))?$/);
  if (!m) return null;
  const [, part, letter, subpart] = m;
  if (subpart) {
    return `Appendix ${letter} to Subpart ${subpart} of Part ${part}`;
  }
  return `Appendix ${letter} to Part ${part}`;
}

// ── VERSION METADATA ────────────────────────────────────────────────────────

export interface ContentVersion {
  date: string;           // effective date (e.g. "2024-11-18")
  amendment_date: string; // when the amendment was made
  issue_date: string;     // Federal Register publication date
  identifier: string;     // section number (e.g. "390.5")
  name: string;           // full section title
  part: string;
  substantive: boolean;
  removed: boolean;
  type: "section" | "appendix";
}

/**
 * Fetch per-section version history from eCFR for a given part.
 * Returns the full list of ContentVersion entries (multiple per section).
 */
export async function getVersionsForPart(part: string): Promise<ContentVersion[]> {
  try {
    const res = await fetch(
      `${ECFR_BASE}/api/versioner/v1/versions/title-${TITLE}?part=${part}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.content_versions ?? []) as ContentVersion[];
  } catch {
    return [];
  }
}

/**
 * For a given part, return a map of section identifier → latest amendment_date.
 * Used by incremental sync to skip sections that haven't changed.
 */
export function getLatestAmendmentDates(versions: ContentVersion[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of versions) {
    const existing = map.get(v.identifier);
    if (!existing || v.amendment_date > existing) {
      map.set(v.identifier, v.amendment_date);
    }
  }
  return map;
}

/**
 * Check if our cached data is stale by comparing to eCFR's latest version date.
 */
export async function checkStaleness(part: string): Promise<{
  stale: boolean;
  cachedVersion: string | null;
  latestVersion: string;
}> {
  const latestVersion = await getLatestDate();
  try {
    const cached = await db.cachedPartToc.findUnique({ where: { part } });
    const cachedVersion = cached?.ecfrVersion ?? null;
    return {
      stale: cachedVersion !== latestVersion,
      cachedVersion,
      latestVersion,
    };
  } catch {
    return { stale: true, cachedVersion: null, latestVersion };
  }
}

// ── CACHED DATA ACCESS ───────────────────────────────────────────────────────

export async function fetchSection(part: string, section: string): Promise<EcfrSection | null> {
  // 1. Try cache
  try {
    const cached = await db.cachedSection.findUnique({ where: { section } });
    if (cached) {
      return {
        part: cached.part,
        section: cached.section,
        title: cached.title,
        content: JSON.parse(cached.contentJson) as EcfrNode[],
        subpartLabel: cached.subpartLabel ?? undefined,
        subpartTitle: cached.subpartTitle ?? undefined,
      };
    }
  } catch (e) {
    console.error("Cache read error:", e);
  }

  // 2. Fallback: fetch from eCFR and cache the result
  const result = await fetchSectionFromEcfr(part, section);
  if (result) {
    try {
      const date = await getLatestDate();
      await db.cachedSection.upsert({
        where: { section },
        create: {
          part,
          section,
          title: result.title,
          contentJson: JSON.stringify(result.content),
          subpartLabel: result.subpartLabel ?? null,
          subpartTitle: result.subpartTitle ?? null,
          ecfrVersion: date,
          rawXml: "",
        },
        update: {
          title: result.title,
          contentJson: JSON.stringify(result.content),
          subpartLabel: result.subpartLabel ?? null,
          subpartTitle: result.subpartTitle ?? null,
          ecfrVersion: date,
        },
      });
    } catch (e) {
      console.error("Cache write error:", e);
    }
  }
  return result;
}

export async function fetchPartStructure(part: string): Promise<PartToc | null> {
  // 1. Try cache
  try {
    const cached = await db.cachedPartToc.findUnique({ where: { part } });
    if (cached) {
      return {
        part: cached.part,
        title: cached.title,
        subparts: JSON.parse(cached.tocJson),
      };
    }
  } catch (e) {
    console.error("TOC cache read error:", e);
  }

  // 2. Fallback: fetch from eCFR and cache
  const result = await fetchPartStructureFromEcfr(part);
  if (result) {
    try {
      const date = await getLatestDate();
      await db.cachedPartToc.upsert({
        where: { part },
        create: {
          part,
          title: result.title,
          tocJson: JSON.stringify(result.subparts),
          ecfrVersion: date,
        },
        update: {
          title: result.title,
          tocJson: JSON.stringify(result.subparts),
          ecfrVersion: date,
        },
      });
    } catch (e) {
      console.error("TOC cache write error:", e);
    }
  }
  return result;
}

export async function getAdjacentSections(
  part: string,
  section: string
): Promise<{ prev: string | null; next: string | null }> {
  const toc = await fetchPartStructure(part);
  if (!toc) return { prev: null, next: null };

  const all = toc.subparts.flatMap((s) => s.sections.map((sec) => sec.section));
  const idx = all.indexOf(section);

  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

// ── ECFR API FETCHERS ────────────────────────────────────────────────────────

async function getLatestDate(): Promise<string> {
  try {
    const res = await fetch(`${ECFR_BASE}/api/versioner/v1/titles`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return FALLBACK_DATE;
    const data = await res.json();
    const title49 = data.titles?.find((t: any) => t.number === 49);
    return title49?.up_to_date_as_of ?? FALLBACK_DATE;
  } catch {
    return FALLBACK_DATE;
  }
}

async function fetchSectionFromEcfr(part: string, section: string): Promise<EcfrSection | null> {
  const date = await getLatestDate();

  // Appendixes use a different URL structure
  let url: string;
  if (isAppendixSection(section)) {
    const identifier = slugToAppendixIdentifier(section);
    if (!identifier) return null;
    url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&appendix=${encodeURIComponent(identifier)}`;
  } else {
    url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${section}`;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 800));
      const fetchOpts = attempt === 0
        ? { next: { revalidate: 3600 } }
        : { cache: 'no-store' as const };
      const res = await fetch(url, fetchOpts);
      if (res.ok) {
        const xml = await res.text();
        return parseXml(xml, part, section);
      }
      console.warn(`fetchSection attempt ${attempt + 1} failed: ${res.status} for ${section}`);
    } catch (e) {
      console.error(`fetchSection attempt ${attempt + 1} error:`, e);
    }
  }
  return null;
}

async function fetchPartStructureFromEcfr(part: string): Promise<PartToc | null> {
  try {
    const date = await getLatestDate();
    const res = await fetch(
      `${ECFR_BASE}/api/versioner/v1/structure/${date}/title-${TITLE}.json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Find the target part within the full title structure
    function findPart(node: any): any {
      if (node.type === "part" && node.identifier === part) return node;
      for (const child of (node.children || [])) {
        const found = findPart(child);
        if (found) return found;
      }
      return null;
    }

    const partNode = findPart(data);
    if (!partNode) return null;

    const subparts: PartToc["subparts"] = [];
    let currentSubpart = { label: "", title: "General", sections: [] as TocEntry[] };
    const appendixEntries: TocEntry[] = [];

    function processNode(node: any) {
      if (node.type === "subpart") {
        if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);
        currentSubpart = {
          label: node.identifier || "",
          title: node.label_description || "",
          sections: [],
        };
        (node.children || []).forEach(processNode);
      } else if (node.type === "section") {
        currentSubpart.sections.push({
          section: node.identifier,
          title: node.label_description || node.label || "",
        });
      } else if (node.type === "appendix") {
        const identifier = node.identifier || node.label || "";
        const slug = appendixToSlug(identifier, part);
        const title = node.label_description || node.label || identifier;
        appendixEntries.push({ section: slug, title, isAppendix: true });
      } else {
        (node.children || []).forEach(processNode);
      }
    }

    (partNode.children || []).forEach(processNode);
    if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

    // Add appendixes as their own group
    if (appendixEntries.length > 0) {
      subparts.push({
        label: "appendixes",
        title: "Appendixes",
        sections: appendixEntries,
      });
    }

    return {
      part,
      title: partNode.label_description || `Part ${part}`,
      subparts,
    };
  } catch (e) {
    console.error("fetchPartStructure error:", e);
    return null;
  }
}

// ── SYNC (called by cron) ────────────────────────────────────────────────────

const FMCSR_PARTS = [
  "40","376","380","381","382","383","385","386","387",
  "390","391","392","393","394","395","396","397","398","399"
];

// Helper to fetch title structure and find a part within it
async function fetchTitleStructure(): Promise<any> {
  const date = await getLatestDate();
  const res = await fetch(
    `${ECFR_BASE}/api/versioner/v1/structure/${date}/title-${TITLE}.json`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Structure fetch failed: HTTP ${res.status}`);
  return res.json();
}

function findPartInStructure(titleData: any, targetPart: string): any {
  function find(node: any): any {
    if (node.type === "part" && node.identifier === targetPart) return node;
    for (const child of (node.children || [])) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  }
  return find(titleData);
}

function buildTocFromPartNode(partNode: any, part: string): PartToc {
  const subparts: PartToc["subparts"] = [];
  let currentSubpart = { label: "", title: "General", sections: [] as TocEntry[] };
  const appendixEntries: TocEntry[] = [];

  function processNode(node: any) {
    if (node.type === "subpart") {
      if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);
      currentSubpart = {
        label: node.identifier || "",
        title: node.label_description || "",
        sections: [],
      };
      (node.children || []).forEach(processNode);
    } else if (node.type === "section") {
      currentSubpart.sections.push({
        section: node.identifier,
        title: node.label_description || node.label || "",
      });
    } else if (node.type === "appendix") {
      // Appendixes appear at the part level or subpart level
      const identifier = node.identifier || node.label || "";
      const slug = appendixToSlug(identifier, part);
      const title = node.label_description || node.label || identifier;
      appendixEntries.push({ section: slug, title, isAppendix: true });
    } else {
      (node.children || []).forEach(processNode);
    }
  }

  (partNode.children || []).forEach(processNode);
  if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

  // Add appendixes as their own "subpart" group if any exist
  if (appendixEntries.length > 0) {
    subparts.push({
      label: "appendixes",
      title: "Appendixes",
      sections: appendixEntries,
    });
  }

  return {
    part,
    title: partNode.label_description || `Part ${part}`,
    subparts,
  };
}

// Step 1: Sync all TOCs (fast — one API call, writes ~19 rows)
export async function syncStructure(): Promise<{ parts: number; errors: string[] }> {
  const date = await getLatestDate();
  const errors: string[] = [];
  let partCount = 0;

  const titleData = await fetchTitleStructure();

  for (const part of FMCSR_PARTS) {
    const partNode = findPartInStructure(titleData, part);
    if (!partNode) {
      errors.push(`Part ${part} not found in structure`);
      continue;
    }

    const toc = buildTocFromPartNode(partNode, part);
    try {
      await db.cachedPartToc.upsert({
        where: { part },
        create: { part, title: toc.title, tocJson: JSON.stringify(toc.subparts), ecfrVersion: date },
        update: { title: toc.title, tocJson: JSON.stringify(toc.subparts), ecfrVersion: date },
      });
      partCount++;
    } catch (e) {
      errors.push(`TOC write failed for part ${part}: ${e}`);
    }
  }

  return { parts: partCount, errors };
}

// Step 2: Sync all sections for one part (incremental — skips unchanged sections)
export async function syncPart(part: string): Promise<{
  updated: number;
  skipped: number;
  changesDetected: string[];
  errors: string[];
}> {
  const date = await getLatestDate();
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;
  const changesDetected: string[] = [];

  // Get the TOC for this part (from cache or fresh)
  const toc = await fetchPartStructure(part);
  if (!toc) {
    return { updated: 0, skipped: 0, changesDetected: [], errors: [`Could not get TOC for part ${part}`] };
  }

  // Fetch version metadata from eCFR to determine which sections changed
  const versions = await getVersionsForPart(part);
  const latestAmendments = getLatestAmendmentDates(versions);

  // Build a lookup of current cached versions
  const cachedSections = await db.cachedSection.findMany({
    where: { part },
    select: { section: true, ecfrVersion: true },
  });
  const cachedVersionMap = new Map(cachedSections.map(c => [c.section, c.ecfrVersion]));

  const allSections = toc.subparts.flatMap(sp => sp.sections);
  for (const sec of allSections) {
    try {
      // Check if this section needs re-fetching.
      // For regular sections, look up by identifier (e.g. "390.5").
      // For appendixes, the versions API uses a different identifier format.
      const cachedVersion = cachedVersionMap.get(sec.section);
      if (cachedVersion) {
        // Determine the eCFR identifier for version lookup
        const ecfrId = sec.isAppendix
          ? slugToAppendixIdentifier(sec.section) ?? sec.section
          : sec.section;
        const latestAmendment = latestAmendments.get(ecfrId);

        // Skip if cached version is at or after the latest amendment
        if (latestAmendment && cachedVersion >= latestAmendment) {
          skipped++;
          continue;
        }
      }

      // Section needs fetching — either new, or amended since last cache
      let url: string;
      if (sec.isAppendix) {
        const identifier = slugToAppendixIdentifier(sec.section);
        if (!identifier) {
          errors.push(`Invalid appendix slug: ${sec.section}`);
          continue;
        }
        url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&appendix=${encodeURIComponent(identifier)}`;
      } else {
        url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${sec.section}`;
      }

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        errors.push(`HTTP ${res.status} for ${sec.section}`);
        continue;
      }
      const xml = await res.text();
      const parsed = parseXml(xml, part, sec.section);
      if (!parsed) {
        errors.push(`Parse failed for ${sec.section}`);
        continue;
      }

      // Check if content actually changed (for change tracking)
      const existing = cachedVersion
        ? await db.cachedSection.findUnique({ where: { section: sec.section }, select: { rawXml: true } })
        : null;
      const contentChanged = existing?.rawXml ? existing.rawXml !== xml : false;

      // Update the cache
      await db.cachedSection.upsert({
        where: { section: sec.section },
        create: {
          part, section: sec.section, title: parsed.title,
          contentJson: JSON.stringify(parsed.content),
          subpartLabel: parsed.subpartLabel ?? null,
          subpartTitle: parsed.subpartTitle ?? null,
          ecfrVersion: date, rawXml: xml,
        },
        update: {
          title: parsed.title,
          contentJson: JSON.stringify(parsed.content),
          subpartLabel: parsed.subpartLabel ?? null,
          subpartTitle: parsed.subpartTitle ?? null,
          ecfrVersion: date, rawXml: xml,
        },
      });

      // If content changed, record in RegChangelog and flag annotations
      if (contentChanged) {
        changesDetected.push(sec.section);
        await recordSectionChange(part, sec.section, parsed, date, versions);
        await flagImpactedAnnotations(sec.section);
      }

      // Also upsert RegSection for version tracking
      const regSectionId = `49-${sec.section}`;
      await db.regSection.upsert({
        where: { id: regSectionId },
        create: {
          id: regSectionId,
          title: parsed.title,
          part,
          section: sec.section,
          rawXml: xml,
          sectionContent: parsed.content as any,
          ecfrVersionDate: date,
        },
        update: {
          title: parsed.title,
          rawXml: xml,
          sectionContent: parsed.content as any,
          ecfrVersionDate: date,
        },
      });

      updated++;
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      errors.push(`Error caching ${sec.section}: ${e}`);
    }
  }

  return { updated, skipped, changesDetected, errors };
}

/** Record a change in RegChangelog when section content differs from cached version */
async function recordSectionChange(
  part: string,
  section: string,
  _parsed: EcfrSection,
  date: string,
  versions: ContentVersion[],
) {
  try {
    const regSectionId = `49-${section}`;

    // Find the latest version entry for this section to get metadata
    const sectionVersions = versions
      .filter(v => v.identifier === section || slugToAppendixIdentifier(section) === v.identifier)
      .sort((a, b) => b.amendment_date.localeCompare(a.amendment_date));

    const latestVersion = sectionVersions[0];

    await db.regChangelog.create({
      data: {
        sectionId: regSectionId,
        versionDate: date,
        changeType: latestVersion?.substantive ? "substantive" : "editorial",
        federalRegCitation: null, // eCFR versions API doesn't include FR citation directly
        effectiveDate: latestVersion ? new Date(latestVersion.date) : null,
      },
    });
  } catch (e) {
    console.error(`[sync] Failed to record changelog for ${section}:`, e);
  }
}

/** Flag all highlights and notes in a changed section as potentially impacted */
async function flagImpactedAnnotations(section: string) {
  try {
    await db.highlight.updateMany({
      where: { sectionId: section, impactedByChange: false },
      data: { impactedByChange: true },
    });
    await db.note.updateMany({
      where: { sectionId: section, impactedByChange: false },
      data: { impactedByChange: true },
    });
    // Bookmarks are section-level, not paragraph-level — still flag them
    // so users know the section content changed
    await db.bookmark.updateMany({
      where: { sectionId: section, impactedByChange: false },
      data: { impactedByChange: true },
    });
  } catch (e) {
    console.error(`[sync] Failed to flag annotations for ${section}:`, e);
  }
}

// ── XML PARSING ──────────────────────────────────────────────────────────────

export function parseXml(xml: string, part: string, section: string): EcfrSection | null {
  try {
    // Appendixes may use DIV9 instead of DIV8
    const isAppendix = isAppendixSection(section);

    const headMatch = xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/);
    const heading = headMatch ? stripTags(headMatch[1]).trim() : "";
    const title = isAppendix
      ? heading // Keep full heading for appendixes (e.g. "Appendix A to Part 385 — Explanation...")
      : heading.replace(/^§\s*[\d.]+[A-Z]?\s*/, "").trim();

    let subpartLabel: string | undefined;
    let subpartTitle: string | undefined;
    const subpartHeadMatch = xml.match(/<DIV6[^>]*>[\s\S]*?<HEAD>([\s\S]*?)<\/HEAD>/);
    if (subpartHeadMatch) {
      const raw = stripTags(subpartHeadMatch[1]).trim();
      const m = raw.match(/Subpart\s+([A-Z]+)\s*[—–-]\s*(.*)/);
      if (m) { subpartLabel = m[1]; subpartTitle = m[2]; }
      else { subpartTitle = raw; }
    }

    const content = parseParagraphs(xml);
    return { part, section, title, content, subpartLabel, subpartTitle };
  } catch (e) {
    console.error("parseXml error:", e);
    return null;
  }
}

// ── PARAGRAPH LEVEL DETECTION ────────────────────────────────────────────────

const ROMANS = new Set(["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx","xxi","xxii","xxiii","xxiv","xxv","l","c"]);
const AMBIGUOUS_ROMANS = new Set(["i","v","x","l","c","m"]);
const ROMAN_ORDER = ["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"];

function continuesLevel1Sequence(label: string, lastAtLevel: Map<number, string>): boolean {
  const lastLevel1 = lastAtLevel.get(1);
  if (!lastLevel1) return false;
  if (label.length !== 1 || lastLevel1.length !== 1) return false;
  const lastLevel2 = lastAtLevel.get(2);
  if (lastLevel2) return false;
  return label.charCodeAt(0) > lastLevel1.charCodeAt(0);
}

function getLevelForLabel(label: string, lastAtLevel: Map<number, string>): number {
  const isDigit = /^\d+$/.test(label);
  const isUpper = /^[A-Z]/.test(label);
  const isMultiRoman = ROMANS.has(label) && label.length > 1;
  const isLower = /^[a-z]+$/.test(label);
  const isAmbiguous = AMBIGUOUS_ROMANS.has(label);

  if (isUpper) return 4;

  if (isMultiRoman) {
    const lastLevel3 = lastAtLevel.get(3);
    const lastLevel5 = lastAtLevel.get(5);
    const lastLevel6 = lastAtLevel.get(6);

    // Check level-6 predecessor first (deeper nesting takes priority)
    if (lastLevel6 && ROMANS.has(lastLevel6)) {
      const prevIdx = ROMAN_ORDER.indexOf(lastLevel6);
      const curIdx = ROMAN_ORDER.indexOf(label);
      if (prevIdx >= 0 && curIdx > prevIdx) return 6;
    }

    // Check level-3 predecessor
    if (lastLevel3 && ROMANS.has(lastLevel3)) {
      const prevIdx = ROMAN_ORDER.indexOf(lastLevel3);
      const curIdx = ROMAN_ORDER.indexOf(label);
      if (prevIdx >= 0 && curIdx > prevIdx) return 3;
    }

    if (lastLevel5 || lastLevel6) return 6;
    return 3;
  }

  if (isDigit) {
    const lastLevel2 = lastAtLevel.get(2);
    const lastLevel4 = lastAtLevel.get(4);
    const lastLevel5 = lastAtLevel.get(5);
    
    // If there's an active level-5 digit sequence, continue it
    if (lastLevel5) return 5;
    
    // If there's an uppercase (level 4) but also a level-2 digit,
    // check which makes more sense: continuing level 2 or starting level 5
    // e.g. (g)(1)(i)(ii)(iii)(A)(B)(2) — (2) continues the (1) at level 2
    // vs   (g)(1)(i)(A)(1) — first (1) under (A) starts level 5
    if (lastLevel4) {
      // If the digit is "1", it's starting a NEW sub-sequence under uppercase → level 5
      if (parseInt(label) === 1 && !lastLevel5) return 5;
      // If we have a level-2 predecessor and this continues it, stay at level 2
      if (lastLevel2 && parseInt(label) > parseInt(lastLevel2)) return 2;
      // Otherwise it's level 5
      return 5;
    }
    
    return 2;
  }

  if (isLower) {
    if (!isAmbiguous) return 1;
    if (continuesLevel1Sequence(label, lastAtLevel)) return 1;

    const lastLevel5 = lastAtLevel.get(5);
    const lastLevel6 = lastAtLevel.get(6);
    if (lastLevel5 && label === "i") return 6;
    if (lastLevel6) return 6;

    const lastLevel2 = lastAtLevel.get(2);
    const lastLevel3 = lastAtLevel.get(3);
    if (lastLevel3) return 3;
    if (lastLevel2 && label === "i") return 3;
    return 1;
  }

  return 1;
}

// ── PACKED PARAGRAPH SPLITTING ───────────────────────────────────────────────

function splitPackedParagraph(text: string): { label: string | undefined; text: string }[] {
  const outerMatch = text.match(/^\(([^)]{1,4})\)\s*(.*)/);
  if (!outerMatch) return [{ label: undefined, text }];
  const outerLabel = outerMatch[1].trim();
  const rest = outerMatch[2];

  if (rest.startsWith("(")) {
    const doubleMatch = rest.match(/^\(([^)]{1,4})\)\s+(.*)/);
    if (doubleMatch) {
      const secondLabel = doubleMatch[1].trim();
      const secondText = doubleMatch[2].trim();
      const outerIsLetter = /^[a-z]$/.test(outerLabel);
      const secondIsDigitOrRoman = /^\d+$/.test(secondLabel) || /^[ivxlc]+$/i.test(secondLabel);
      if (outerIsLetter && secondIsDigitOrRoman) {
        const result: { label: string | undefined; text: string }[] = [
          { label: outerLabel, text: "" },
        ];
        result.push(...splitPackedParagraph(`(${secondLabel}) ${secondText}`));
        return result;
      }
    }
  }

  const innerMatch = rest.match(/^(.*?(?:\.|—|:|;))\s*(\([^)]{1,4}\))\s+(.+)/);
  if (innerMatch) {
    const intro = innerMatch[1].trim().replace(/[—:;]\s*$/, '').trim();
    const innerLabel = innerMatch[2].slice(1, -1).trim();
    const innerText = innerMatch[3].trim();
    if (intro.length < 80) {
      const result: { label: string | undefined; text: string }[] = [
        { label: outerLabel, text: intro },
      ];
      result.push(...splitPackedParagraph(`(${innerLabel}) ${innerText}`));
      return result;
    }
  }

  return [{ label: outerLabel, text: rest }];
}

// ── PARAGRAPH PARSER ─────────────────────────────────────────────────────────

function parseParagraphs(xml: string): EcfrNode[] {
  const nodes: EcfrNode[] = [];
  let counter = 0;
  const lastAtLevel = new Map<number, string>();

  const bodyMatch = xml.match(/<DIV8[^>]*>([\s\S]*)<\/DIV8>/) || xml.match(/<DIV9[^>]*>([\s\S]*)<\/DIV9>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const chunkRegex = /(<GPOTABLE[\s\S]*?<\/GPOTABLE>|<TABLE[\s\S]*?<\/TABLE>|<GPH[\s\S]*?<\/GPH>|<EXTRACT[\s\S]*?<\/EXTRACT>|<img[^>]*\/?>|<HD[123][^>]*>[\s\S]*?<\/HD[123]>|<P>[\s\S]*?<\/P>|<FP[^>]*>[\s\S]*?<\/FP>)/gi;
  const chunks = body.match(chunkRegex) || [];

  for (const chunk of chunks) {
    // TABLE
    if (chunk.startsWith("<GPOTABLE") || chunk.startsWith("<gpotable")) {
      const headers: string[] = [];
      const rows: string[][] = [];

      const boxhdMatch = chunk.match(/<BOXHD>([\s\S]*?)<\/BOXHD>/i);
      if (boxhdMatch) {
        const chedRegex = /<CHED[^>]*>([\s\S]*?)<\/CHED>/gi;
        let chedMatch;
        while ((chedMatch = chedRegex.exec(boxhdMatch[1])) !== null) {
          headers.push(stripTags(chedMatch[1]).trim());
        }
      }

      const rowRegex = /<ROW>([\s\S]*?)<\/ROW>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(chunk)) !== null) {
        const cells: string[] = [];
        const entRegex = /<ENT[^>]*>([\s\S]*?)<\/ENT>/gi;
        let entMatch;
        while ((entMatch = entRegex.exec(rowMatch[1])) !== null) {
          cells.push(stripTags(entMatch[1]).trim());
        }
        if (cells.length) rows.push(cells);
      }

      if (headers.length || rows.length) {
        nodes.push({ id: `t-${counter++}`, type: "table", text: "", level: 0, tableHeaders: headers, tableRows: rows });
      }
      continue;
    }

    // HTML TABLE — <TABLE> with <TR>/<TH>/<TD>
    if (chunk.toUpperCase().startsWith("<TABLE")) {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers from <TH> tags in <THEAD> or first <TR>
      const theadMatch = chunk.match(/<THEAD>([\s\S]*?)<\/THEAD>/i);
      if (theadMatch) {
        const thRegex = /<TH[^>]*>([\s\S]*?)<\/TH>/gi;
        let thMatch;
        while ((thMatch = thRegex.exec(theadMatch[1])) !== null) {
          headers.push(stripTags(thMatch[1]).trim());
        }
      }

      // Extract rows from <TBODY> or all <TR> tags
      const tbodyMatch = chunk.match(/<TBODY>([\s\S]*?)<\/TBODY>/i);
      const rowSource = tbodyMatch ? tbodyMatch[1] : chunk;
      const trRegex = /<TR[^>]*>([\s\S]*?)<\/TR>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(rowSource)) !== null) {
        const cells: string[] = [];
        // Check for TH cells (in case headers are in body rows)
        const hasOnlyTh = /<TH/i.test(trMatch[1]) && !/<TD/i.test(trMatch[1]);
        if (hasOnlyTh && headers.length === 0) {
          const thRegex2 = /<TH[^>]*>([\s\S]*?)<\/TH>/gi;
          let th;
          while ((th = thRegex2.exec(trMatch[1])) !== null) {
            headers.push(stripTags(th[1]).trim());
          }
          continue;
        }
        // Extract TD cells
        const tdRegex = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
          cells.push(stripTags(tdMatch[1]).trim());
        }
        if (cells.length) rows.push(cells);
      }

      if (headers.length || rows.length) {
        nodes.push({ id: `t-${counter++}`, type: "table", text: "", level: 0, tableHeaders: headers, tableRows: rows });
      }
      continue;
    }

    // IMAGE — <img>
    if (chunk.toLowerCase().startsWith("<img")) {
      const srcMatch = chunk.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        nodes.push({ id: `img-${counter++}`, type: "image", text: "", level: 0, imageSrc: srcMatch[1] });
      }
      continue;
    }

    // IMAGE — <GPH>
    if (chunk.toUpperCase().startsWith("<GPH")) {
      const gidMatch = chunk.match(/<GID>([\s\S]*?)<\/GID>/i);
      if (gidMatch) {
        const filename = gidMatch[1].trim();
        const src = filename.startsWith("http") ? filename : `/graphics/${filename}`;
        nodes.push({ id: `img-${counter++}`, type: "image", text: "", level: 0, imageSrc: src });
      }
      continue;
    }

    // HEADING — <HD1>, <HD2>, <HD3> (common in appendices)
    if (/^<HD[123]/i.test(chunk)) {
      const lvlMatch = chunk.match(/^<HD([123])/i);
      const headingLevel = lvlMatch ? parseInt(lvlMatch[1]) : 1;
      const text = stripTags(chunk).trim();
      if (text) {
        nodes.push({ id: `h-${counter++}`, type: "heading", text, level: 0, headingLevel });
      }
      continue;
    }

    // EXTRACT
    if (chunk.toUpperCase().startsWith("<EXTRACT")) {
      const innerPs = chunk.match(/<P>[\s\S]*?<\/P>/gi) || [];
      for (const p of innerPs) {
        const inner = p.replace(/^<P>/i, "").replace(/<\/P>$/i, "");
        const text = stripTags(inner).trim();
        if (!text || text.length < 3) continue;
        nodes.push({ id: `p-${counter++}`, type: "paragraph", text, level: 0 });
      }
      continue;
    }

    // FP (Flush Paragraph)
    if (chunk.toUpperCase().startsWith("<FP")) {
      const inner = chunk.replace(/^<FP[^>]*>/i, "").replace(/<\/FP>$/i, "");
      const text = stripTags(inner).trim();
      if (!text || text.length < 3) continue;
      const splitParagraphs = splitPackedParagraph(text);
      for (const { label: rawLabel, text: pText } of splitParagraphs) {
        const label = rawLabel?.trim();
        const level = label ? getLevelForLabel(label, lastAtLevel) : 0;
        if (label) {
          for (let l = level + 1; l <= 6; l++) lastAtLevel.delete(l);
          lastAtLevel.set(level, label);
        }
        nodes.push({ id: `p-${counter++}`, type: "paragraph", label, text: pText, level });
      }
      continue;
    }

    // PARAGRAPH
    if (chunk.startsWith("<P>") || chunk.startsWith("<p>")) {
      const inner = chunk.replace(/^<P>/i, "").replace(/<\/P>$/i, "");
      const text = stripTags(inner).trim();
      if (!text || text.length < 3) continue;

      const splitParagraphs = splitPackedParagraph(text);
      for (const { label: rawLabel, text: pText } of splitParagraphs) {
        const label = rawLabel?.trim();
        const level = label ? getLevelForLabel(label, lastAtLevel) : 0;
        if (label) {
          for (let l = level + 1; l <= 6; l++) lastAtLevel.delete(l);
          lastAtLevel.set(level, label);
        }
        nodes.push({ id: `p-${counter++}`, type: "paragraph", label, text: pText, level });
      }
    }
  }

  if (nodes.length === 0) {
    const text = stripTags(xml).trim();
    if (text) nodes.push({ id: "p-0", type: "paragraph", text, level: 0 });
  }

  return nodes;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&sect;/g, "§")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, " ")
    .trim();
}
