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
  type: "paragraph" | "table" | "image";
  label?: string;
  text: string;
  level: number;
  tableHeaders?: string[];
  tableRows?: string[][];
  imageSrc?: string;
  imageCaption?: string;
}

export interface TocEntry {
  section: string;
  title: string;
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

export function parseSectionSlug(slug: string): { part: string; section: string } | null {
  const match = slug.match(/^(\d+)\.(.+)$/);
  if (!match) return null;
  return { part: match[1], section: slug };
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
  const url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${section}`;

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
      } else {
        (node.children || []).forEach(processNode);
      }
    }

    (partNode.children || []).forEach(processNode);
    if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

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
    } else {
      (node.children || []).forEach(processNode);
    }
  }

  (partNode.children || []).forEach(processNode);
  if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

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

// Step 2: Sync all sections for one part
export async function syncPart(part: string): Promise<{ sections: number; errors: string[] }> {
  const date = await getLatestDate();
  const errors: string[] = [];
  let sectionCount = 0;

  // Get the TOC for this part (from cache or fresh)
  const toc = await fetchPartStructure(part);
  if (!toc) {
    return { sections: 0, errors: [`Could not get TOC for part ${part}`] };
  }

  const allSections = toc.subparts.flatMap(sp => sp.sections);
  for (const sec of allSections) {
    try {
      const url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${sec.section}`;
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
      sectionCount++;
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      errors.push(`Error caching ${sec.section}: ${e}`);
    }
  }

  return { sections: sectionCount, errors };
}

// ── XML PARSING ──────────────────────────────────────────────────────────────

function parseXml(xml: string, part: string, section: string): EcfrSection | null {
  try {
    const headMatch = xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/);
    const heading = headMatch ? stripTags(headMatch[1]).trim() : "";
    const title = heading.replace(/^§\s*[\d.]+[A-Z]?\s*/, "").trim();

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

  const bodyMatch = xml.match(/<DIV8[^>]*>([\s\S]*)<\/DIV8>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const chunkRegex = /(<GPOTABLE[\s\S]*?<\/GPOTABLE>|<TABLE[\s\S]*?<\/TABLE>|<GPH[\s\S]*?<\/GPH>|<EXTRACT[\s\S]*?<\/EXTRACT>|<img[^>]*\/?>|<P>[\s\S]*?<\/P>|<FP[^>]*>[\s\S]*?<\/FP>)/gi;
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
