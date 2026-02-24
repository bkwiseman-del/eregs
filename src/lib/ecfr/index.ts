const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = "49";

const FALLBACK_DATE = "2026-02-19";

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
  // table-specific
  tableHeaders?: string[];
  tableRows?: string[][];
  // image-specific
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

export async function fetchPartStructure(part: string): Promise<PartToc | null> {
  try {
    // Part-specific endpoint — small payload, no 2MB issue
    const res = await fetch(
      `${ECFR_BASE}/api/versioner/v1/structure/current/title-${TITLE}/part-${part}.json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Part endpoint returns the part node as root — no tree traversal needed
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

    (data.children || []).forEach(processNode);
    if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

    return {
      part,
      title: data.label_description || `Part ${part}`,
      subparts,
    };
  } catch (e) {
    console.error("fetchPartStructure error:", e);
    return null;
  }
}

export async function fetchSection(part: string, section: string): Promise<EcfrSection | null> {
  const date = await getLatestDate();
  const url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${section}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 600));
      const res = await fetch(url, { next: { revalidate: 3600 } });
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

// CFR uses a strict 4-level hierarchy: (a)(1)(i)(A)
// Ambiguous single chars: i, v, x, l, c, m could be level-1 letters OR level-3 roman numerals
// Strategy: track the last seen label at each level to determine where a new label fits
// Roman numerals only appear AFTER digits (level 2), never directly after letters (level 1)

const ROMANS = new Set(["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx","xxi","xxii","xxiii","xxiv","xxv","l","c"]);
const AMBIGUOUS_ROMANS = new Set(["i","v","x","l","c","m"]);

function getLevelForLabel(label: string, lastAtLevel: Map<number, string>): number {
  const isDigit = /^\d+$/.test(label);
  const isUpper = /^[A-Z]/.test(label);
  const isMultiRoman = ROMANS.has(label) && label.length > 1;
  const isLower = /^[a-z]+$/.test(label);
  const isAmbiguous = AMBIGUOUS_ROMANS.has(label);

  if (isDigit) return 2;
  if (isUpper) return 4;
  if (isMultiRoman) return 3; // "ii", "iii", "iv" etc — unambiguously roman

  if (isLower) {
    if (!isAmbiguous) return 1; // f, g, h, j, k, n, o, p, q, r, s, t, u, w, y, z — never roman

    // Ambiguous: i, v, x, l, c, m
    // It's roman (level 3) only if we've already seen a digit (level 2) label
    // i.e. romans appear inside numbered paragraphs, not directly inside lettered ones
    const lastLevel2 = lastAtLevel.get(2);
    const lastLevel3 = lastAtLevel.get(3);

    if (lastLevel3) return 3; // already in a roman sequence
    if (lastLevel2 && label === "i") return 3; // first roman after a digit
    return 1; // otherwise it's just a letter (e.g. section (i) of a regulation)
  }

  return 1;
}

// Split paragraphs packed like "(a) General. (1) The rules..." or "(b) Foo —(1) Bar..."
// into separate nodes: [(a, "General."), (1, "The rules...")]
function splitPackedParagraph(text: string): { label: string | undefined; text: string }[] {
  const outerMatch = text.match(/^\(([^)]{1,4})\)\s*(.*)/);
  if (!outerMatch) return [{ label: undefined, text }];

  const outerLabel = outerMatch[1];
  const rest = outerMatch[2];

  // Look for embedded sub-label after em-dash, period+space, or colon
  // e.g. "General. (1) The rules..." or "Driving conditions —(1) Adverse..."
  const innerMatch = rest.match(/^(.*?(?:\.|—|:))\s*(\([^)]{1,4}\))\s+(.+)/);
  if (innerMatch) {
    const intro = innerMatch[1].trim();
    const innerLabel = innerMatch[2].slice(1, -1);
    const innerText = innerMatch[3].trim();

    // Only split if intro is short (it's a title, not a full paragraph)
    // Long intro text means the period is mid-sentence, not a title separator
    if (intro.length < 80) {
      return [
        { label: outerLabel, text: intro },
        { label: innerLabel, text: innerText },
      ];
    }
  }

  return [{ label: outerLabel, text: rest }];
}

function parseParagraphs(xml: string): EcfrNode[] {
  const nodes: EcfrNode[] = [];
  let counter = 0;
  const lastAtLevel = new Map<number, string>(); // tracks last seen label at each level

  // Process content in document order by iterating through all relevant tags
  // We replace each tag with a placeholder then process in sequence
  const tagRegex = /<(P|GPOTABLE|img)([^>]*)>([\s\S]*?)<\/(?:P|GPOTABLE)>|<img([^>]*)\/?>|<img([^>]*)>/gi;

  // Instead, process the section body linearly
  // Extract the section body (everything inside the section div)
  const bodyMatch = xml.match(/<DIV8[^>]*>([\s\S]*)<\/DIV8>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  // Split into chunks by tag boundaries we care about
  // Process GPOTABLE, img, and P tags in order
  const chunkRegex = /(<GPOTABLE[\s\S]*?<\/GPOTABLE>|<img[^>]*\/?>|<P>[\s\S]*?<\/P>)/gi;
  const chunks = body.match(chunkRegex) || [];

  for (const chunk of chunks) {
    // TABLE
    if (chunk.startsWith("<GPOTABLE") || chunk.startsWith("<gpotable")) {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Parse BOXHD headers
      const boxhdMatch = chunk.match(/<BOXHD>([\s\S]*?)<\/BOXHD>/i);
      if (boxhdMatch) {
        const chedRegex = /<CHED[^>]*>([\s\S]*?)<\/CHED>/gi;
        let chedMatch;
        while ((chedMatch = chedRegex.exec(boxhdMatch[1])) !== null) {
          headers.push(stripTags(chedMatch[1]).trim());
        }
      }

      // Parse ROW entries
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
        nodes.push({
          id: `t-${counter++}`,
          type: "table",
          text: "",
          level: 0,
          tableHeaders: headers,
          tableRows: rows,
        });
      }
      continue;
    }

    // IMAGE
    if (chunk.toLowerCase().startsWith("<img")) {
      const srcMatch = chunk.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        // Also look for a preceding TCAP caption
        nodes.push({
          id: `img-${counter++}`,
          type: "image",
          text: "",
          level: 0,
          imageSrc: srcMatch[1],
        });
      }
      continue;
    }

    // PARAGRAPH
    if (chunk.startsWith("<P>") || chunk.startsWith("<p>")) {
      const inner = chunk.replace(/^<P>/i, "").replace(/<\/P>$/i, "");
      const text = stripTags(inner).trim();
      if (!text || text.length < 3) continue;

      // Split paragraphs that pack multiple labeled items into one <P>
      // e.g. "(b) Driving conditions —(1) Adverse driving conditions. Some text..."
      // becomes two nodes: (b) intro + (1) content
      const splitParagraphs = splitPackedParagraph(text);

      for (const { label, text: pText } of splitParagraphs) {
        const level = label ? getLevelForLabel(label, lastAtLevel) : 0;
        if (label) lastAtLevel.set(level, label);
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
    // Decode common HTML entities
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
