// eCFR API client
// All FMCSR sections are under Title 49

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = "49";

// Fetch the latest available date from eCFR for Title 49
let _cachedDate: string | null = null;
async function getLatestDate(): Promise<string> {
  if (_cachedDate) return _cachedDate;
  try {
    const res = await fetch(`${ECFR_BASE}/api/versioner/v1/titles`, {
      next: { revalidate: 86400 },
    });
    const data = await res.json();
    const title49 = data.titles?.find((t: any) => t.number === 49);
    if (title49?.up_to_date_as_of) {
      _cachedDate = title49.up_to_date_as_of;
      return _cachedDate!;
    }
  } catch {}
  return "2026-02-19"; // fallback
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
  label?: string;
  text: string;
  children?: EcfrNode[];
  level: number;
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
  const match = slug.match(/^(\d+)\.(\S+)$/);
  if (!match) return null;
  return { part: match[1], section: slug };
}

// Fetch TOC using the structure endpoint (full title, parse out just the part)
export async function fetchPartStructure(part: string): Promise<PartToc | null> {
  try {
    const res = await fetch(
      `${ECFR_BASE}/api/versioner/v1/structure/current/title-${TITLE}.json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    let partData: any = null;
    function findPart(node: any) {
      if (node.type === "part" && node.identifier === part) { partData = node; return; }
      for (const child of node.children || []) findPart(child);
    }
    findPart(data);
    if (!partData) return null;

    const subparts: PartToc["subparts"] = [];
    let currentSubpart = { label: "", title: "General", sections: [] as TocEntry[] };

    function processNode(node: any) {
      if (node.type === "subpart") {
        if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);
        currentSubpart = { label: node.identifier || "", title: node.label_description || "", sections: [] };
        (node.children || []).forEach(processNode);
      } else if (node.type === "section") {
        currentSubpart.sections.push({ section: node.identifier, title: node.label_description || node.label || "" });
      } else {
        (node.children || []).forEach(processNode);
      }
    }

    (partData.children || []).forEach(processNode);
    if (currentSubpart.sections.length > 0) subparts.push(currentSubpart);

    return { part, title: partData.label_description || `Part ${part}`, subparts };
  } catch (e) {
    console.error("fetchPartStructure error:", e);
    return null;
  }
}

// Fetch a section's XML content using the latest available date
export async function fetchSection(part: string, section: string): Promise<EcfrSection | null> {
  try {
    const date = await getLatestDate();
    const res = await fetch(
      `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${section}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const xml = await res.text();
    return parseXml(xml, part, section);
  } catch (e) {
    console.error("fetchSection error:", e);
    return null;
  }
}

function parseXml(xml: string, part: string, section: string): EcfrSection | null {
  try {
    const headMatch = xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/);
    const heading = headMatch ? stripTags(headMatch[1]).trim() : "";
    const title = heading.replace(/^§\s*[\d.]+\s*/, "").trim();

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

function parseParagraphs(xml: string): EcfrNode[] {
  const nodes: EcfrNode[] = [];
  let counter = 0;

  const pRegex = /<P>([\s\S]*?)<\/P>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const text = stripTags(match[1]).trim();
    if (!text || text.length < 3) continue;

    const labelMatch = text.match(/^\(([^)]{1,4})\)\s*/);
    const label = labelMatch ? labelMatch[1] : undefined;
    const content = labelMatch ? text.slice(labelMatch[0].length) : text;

    let level = 0;
    if (label) {
      if (/^[a-z]$/.test(label)) level = 1;
      else if (/^\d+$/.test(label)) level = 2;
      else if (/^[ivxlc]+$/.test(label)) level = 3;
      else if (/^[A-Z]$/.test(label)) level = 4;
    }

    nodes.push({ id: `p-${counter++}`, label, text: content, level });
  }

  if (nodes.length === 0) {
    const text = stripTags(xml).trim();
    if (text) nodes.push({ id: "p-0", text, level: 0 });
  }

  return nodes;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
