import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = "49";

const FMCSR_PARTS = [
  "40","376","380","381","382","383","385","386","387",
  "390","391","392","393","394","395","396","397","398","399"
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ── Import the parser dynamically since it uses @/ paths ─────────────────────
// We duplicate the parser here to avoid path alias issues with tsx

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&sect;/g, "§")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, " ").trim();
}

const ROMANS = new Set(["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx","xxi","xxii","xxiii","xxiv","xxv","l","c"]);
const AMBIGUOUS_ROMANS = new Set(["i","v","x","l","c","m"]);
const ROMAN_ORDER = ["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"];

function continuesLevel1Sequence(label: string, lastAtLevel: Map<number, string>): boolean {
  const lastLevel1 = lastAtLevel.get(1);
  if (!lastLevel1 || label.length !== 1 || lastLevel1.length !== 1) return false;
  if (lastAtLevel.get(2)) return false;
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
    if (lastLevel6 && ROMANS.has(lastLevel6)) {
      const p = ROMAN_ORDER.indexOf(lastLevel6), c = ROMAN_ORDER.indexOf(label);
      if (p >= 0 && c > p) return 6;
    }
    if (lastLevel3 && ROMANS.has(lastLevel3)) {
      const p = ROMAN_ORDER.indexOf(lastLevel3), c = ROMAN_ORDER.indexOf(label);
      if (p >= 0 && c > p) return 3;
    }
    if (lastLevel5 || lastLevel6) return 6;
    return 3;
  }
  if (isDigit) {
    const lastLevel2 = lastAtLevel.get(2);
    const lastLevel4 = lastAtLevel.get(4);
    const lastLevel5 = lastAtLevel.get(5);
    if (lastLevel5) return 5;
    if (lastLevel4) {
      if (parseInt(label) === 1 && !lastLevel5) return 5;
      if (lastLevel2 && parseInt(label) > parseInt(lastLevel2)) return 2;
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
      if (/^[a-z]$/.test(outerLabel) && (/^\d+$/.test(secondLabel) || /^[ivxlc]+$/i.test(secondLabel))) {
        return [{ label: outerLabel, text: "" }, ...splitPackedParagraph(`(${secondLabel}) ${secondText}`)];
      }
    }
  }
  const innerMatch = rest.match(/^(.*?(?:\.|—|:|;))\s*(\([^)]{1,4}\))\s+(.+)/);
  if (innerMatch) {
    const intro = innerMatch[1].trim().replace(/[—:;]\s*$/, '').trim();
    const innerLabel = innerMatch[2].slice(1, -1).trim();
    const innerText = innerMatch[3].trim();
    if (intro.length < 80) {
      return [{ label: outerLabel, text: intro }, ...splitPackedParagraph(`(${innerLabel}) ${innerText}`)];
    }
  }
  return [{ label: outerLabel, text: rest }];
}

function parseParagraphs(xml: string): any[] {
  const nodes: any[] = [];
  let counter = 0;
  const lastAtLevel = new Map<number, string>();

  const bodyMatch = xml.match(/<DIV8[^>]*>([\s\S]*)<\/DIV8>/);
  const body = bodyMatch ? bodyMatch[1] : xml;

  const chunkRegex = /(<GPOTABLE[\s\S]*?<\/GPOTABLE>|<TABLE[\s\S]*?<\/TABLE>|<GPH[\s\S]*?<\/GPH>|<EXTRACT[\s\S]*?<\/EXTRACT>|<img[^>]*\/?>|<P>[\s\S]*?<\/P>|<FP[^>]*>[\s\S]*?<\/FP>)/gi;
  const chunks = body.match(chunkRegex) || [];

  for (const chunk of chunks) {
    // GPOTABLE
    if (chunk.startsWith("<GPOTABLE") || chunk.startsWith("<gpotable")) {
      const headers: string[] = [];
      const rows: string[][] = [];
      const boxhdMatch = chunk.match(/<BOXHD>([\s\S]*?)<\/BOXHD>/i);
      if (boxhdMatch) {
        const chedRegex = /<CHED[^>]*>([\s\S]*?)<\/CHED>/gi;
        let m; while ((m = chedRegex.exec(boxhdMatch[1])) !== null) headers.push(stripTags(m[1]).trim());
      }
      const rowRegex = /<ROW>([\s\S]*?)<\/ROW>/gi;
      let rm; while ((rm = rowRegex.exec(chunk)) !== null) {
        const cells: string[] = [];
        const entRegex = /<ENT[^>]*>([\s\S]*?)<\/ENT>/gi;
        let em; while ((em = entRegex.exec(rm[1])) !== null) cells.push(stripTags(em[1]).trim());
        if (cells.length) rows.push(cells);
      }
      if (headers.length || rows.length) {
        nodes.push({ id: `t-${counter++}`, type: "table", text: "", level: 0, tableHeaders: headers, tableRows: rows });
      }
      continue;
    }

    // HTML TABLE
    if (chunk.toUpperCase().startsWith("<TABLE")) {
      const headers: string[] = [];
      const rows: string[][] = [];
      const theadMatch = chunk.match(/<THEAD>([\s\S]*?)<\/THEAD>/i);
      if (theadMatch) {
        const thRegex = /<TH[^>]*>([\s\S]*?)<\/TH>/gi;
        let thMatch;
        while ((thMatch = thRegex.exec(theadMatch[1])) !== null) headers.push(stripTags(thMatch[1]).trim());
      }
      const tbodyMatch = chunk.match(/<TBODY>([\s\S]*?)<\/TBODY>/i);
      const rowSource = tbodyMatch ? tbodyMatch[1] : chunk;
      const trRegex = /<TR[^>]*>([\s\S]*?)<\/TR>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(rowSource)) !== null) {
        const cells: string[] = [];
        const hasOnlyTh = /<TH/i.test(trMatch[1]) && !/<TD/i.test(trMatch[1]);
        if (hasOnlyTh && headers.length === 0) {
          const thRegex2 = /<TH[^>]*>([\s\S]*?)<\/TH>/gi;
          let th;
          while ((th = thRegex2.exec(trMatch[1])) !== null) headers.push(stripTags(th[1]).trim());
          continue;
        }
        const tdRegex = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) cells.push(stripTags(tdMatch[1]).trim());
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
      if (srcMatch) nodes.push({ id: `img-${counter++}`, type: "image", text: "", level: 0, imageSrc: srcMatch[1] });
      continue;
    }
    // IMAGE — <GPH>
    if (chunk.toUpperCase().startsWith("<GPH")) {
      const gidMatch = chunk.match(/<GID>([\s\S]*?)<\/GID>/i);
      if (gidMatch) {
        const fn = gidMatch[1].trim();
        nodes.push({ id: `img-${counter++}`, type: "image", text: "", level: 0, imageSrc: fn.startsWith("http") ? fn : `/graphics/${fn}` });
      }
      continue;
    }
    // EXTRACT
    if (chunk.toUpperCase().startsWith("<EXTRACT")) {
      const innerPs = chunk.match(/<P>[\s\S]*?<\/P>/gi) || [];
      for (const p of innerPs) {
        const text = stripTags(p.replace(/^<P>/i, "").replace(/<\/P>$/i, "")).trim();
        if (text && text.length >= 3) nodes.push({ id: `p-${counter++}`, type: "paragraph", text, level: 0 });
      }
      continue;
    }
    // FP or P
    const isFP = chunk.toUpperCase().startsWith("<FP");
    const isP = chunk.startsWith("<P>") || chunk.startsWith("<p>");
    if (isFP || isP) {
      const inner = isFP
        ? chunk.replace(/^<FP[^>]*>/i, "").replace(/<\/FP>$/i, "")
        : chunk.replace(/^<P>/i, "").replace(/<\/P>$/i, "");
      const text = stripTags(inner).trim();
      if (!text || text.length < 3) continue;
      const splits = splitPackedParagraph(text);
      for (const { label: rawLabel, text: pText } of splits) {
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

function parseXml(xml: string, part: string, section: string) {
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
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function getLatestDate(): Promise<string> {
  const res = await fetch(`${ECFR_BASE}/api/versioner/v1/titles`);
  const data = await res.json();
  const t49 = data.titles?.find((t: any) => t.number === 49);
  return t49?.up_to_date_as_of ?? "2026-02-20";
}

async function main() {
  console.log("DB URL:", process.env.DATABASE_URL ? "set" : "NOT SET");
  await db.$connect();
  console.log("DB connected");

  const date = await getLatestDate();
  console.log(`eCFR date: ${date}`);

  // Check for --reparse flag: re-parse existing rawXml without re-fetching
  const reparse = process.argv.includes('--reparse');

  if (reparse) {
    console.log("Re-parsing cached XML (no eCFR fetch)...");
    const allCached = await db.cachedSection.findMany({ select: { section: true, part: true, rawXml: true } });
    let ok = 0;
    for (const row of allCached) {
      if (!row.rawXml) continue;
      const parsed = parseXml(row.rawXml, row.part, row.section);
      await db.cachedSection.update({
        where: { section: row.section },
        data: { contentJson: JSON.stringify(parsed.content), title: parsed.title,
          subpartLabel: parsed.subpartLabel ?? null, subpartTitle: parsed.subpartTitle ?? null },
      });
      ok++;
    }
    console.log(`Re-parsed ${ok} sections`);
    await db.$disconnect();
    return;
  }

  // Full sync
  console.log("Fetching title structure...");
  const structRes = await fetch(`${ECFR_BASE}/api/versioner/v1/structure/${date}/title-${TITLE}.json`);
  if (!structRes.ok) { console.error("Failed to fetch structure"); process.exit(1); }
  const titleData = await structRes.json();

  function findPart(node: any, target: string): any {
    if (node.type === "part" && node.identifier === target) return node;
    for (const child of (node.children || [])) {
      const found = findPart(child, target);
      if (found) return found;
    }
    return null;
  }

  for (const part of FMCSR_PARTS) {
    const partNode = findPart(titleData, part);
    if (!partNode) { console.log(`  Part ${part}: NOT FOUND`); continue; }

    const subparts: any[] = [];
    let cur = { label: "", title: "General", sections: [] as any[] };
    function walk(node: any) {
      if (node.type === "subpart") {
        if (cur.sections.length > 0) subparts.push(cur);
        cur = { label: node.identifier || "", title: node.label_description || "", sections: [] };
        (node.children || []).forEach(walk);
      } else if (node.type === "section") {
        cur.sections.push({ section: node.identifier, title: node.label_description || node.label || "" });
      } else {
        (node.children || []).forEach(walk);
      }
    }
    (partNode.children || []).forEach(walk);
    if (cur.sections.length > 0) subparts.push(cur);

    const partTitle = partNode.label_description || `Part ${part}`;

    await db.cachedPartToc.upsert({
      where: { part },
      create: { part, title: partTitle, tocJson: JSON.stringify(subparts), ecfrVersion: date },
      update: { title: partTitle, tocJson: JSON.stringify(subparts), ecfrVersion: date },
    });

    const allSections = subparts.flatMap((sp: any) => sp.sections);
    console.log(`Part ${part}: ${allSections.length} sections`);

    let ok = 0, fail = 0;
    for (const sec of allSections) {
      try {
        const url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.xml?part=${part}&section=${sec.section}`;
        const res = await fetch(url);
        if (!res.ok) { fail++; continue; }
        const xml = await res.text();
        const parsed = parseXml(xml, part, sec.section);

        await db.cachedSection.upsert({
          where: { section: sec.section },
          create: {
            part, section: sec.section, title: parsed.title,
            contentJson: JSON.stringify(parsed.content),
            subpartLabel: parsed.subpartLabel ?? null, subpartTitle: parsed.subpartTitle ?? null,
            ecfrVersion: date, rawXml: xml,
          },
          update: {
            title: parsed.title, contentJson: JSON.stringify(parsed.content),
            subpartLabel: parsed.subpartLabel ?? null, subpartTitle: parsed.subpartTitle ?? null,
            ecfrVersion: date, rawXml: xml,
          },
        });
        ok++;
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        fail++;
      }
    }
    console.log(`  ✓ ${ok} cached, ${fail} failed`);
  }

  console.log("\nDone!");
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
