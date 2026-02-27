import { db } from "@/lib/db";

interface EcfrNode {
  id: string;
  type: string;
  label?: string;
  text?: string;
  level: number;
  tableHeaders?: string[];
  tableRows?: string[][];
  imageCaption?: string;
}

/** Extract plain text from EcfrNode[] JSON (CachedSection.contentJson). */
export function ecfrNodesToPlainText(contentJson: string): string {
  try {
    const nodes: EcfrNode[] = JSON.parse(contentJson);
    return nodes
      .map((node) => {
        const parts: string[] = [];
        if (node.label) parts.push(node.label);
        if (node.text) parts.push(node.text);
        if (node.tableHeaders) parts.push(node.tableHeaders.join(" "));
        if (node.tableRows)
          parts.push(node.tableRows.map((r) => r.join(" ")).join(" "));
        if (node.imageCaption) parts.push(node.imageCaption);
        return parts.join(" ");
      })
      .join("\n");
  } catch {
    return "";
  }
}

/** Create a short snippet from text for display in search results. */
export function makeSnippet(text: string, maxLen = 300): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

/** Index a single CachedSection into SearchDocument. Accepts a CachedSection.id or .section (unique). */
export async function indexRegulationSection(idOrSection: string) {
  // Try by id first, then by section (which is unique)
  let s = await db.cachedSection.findUnique({
    where: { id: idOrSection },
    select: { id: true, part: true, section: true, title: true, contentJson: true },
  });
  if (!s) {
    s = await db.cachedSection.findUnique({
      where: { section: idOrSection },
      select: { id: true, part: true, section: true, title: true, contentJson: true },
    });
  }
  if (!s) return;

  const plainText = ecfrNodesToPlainText(s.contentJson);
  await db.searchDocument.upsert({
    where: {
      sourceType_sourceId: { sourceType: "REGULATION", sourceId: s.id },
    },
    create: {
      sourceType: "REGULATION",
      sourceId: s.id,
      title: `§ ${s.section} ${s.title}`,
      snippet: makeSnippet(plainText),
      section: s.section,
      part: s.part,
      plainText,
    },
    update: {
      title: `§ ${s.section} ${s.title}`,
      snippet: makeSnippet(plainText),
      plainText,
    },
  });
}

/** Index a single FeedItem into SearchDocument. */
export async function indexFeedItem(itemId: string) {
  const item = await db.feedItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const plainText = [item.title, item.description ?? ""].join("\n");
  await db.searchDocument.upsert({
    where: {
      sourceType_sourceId: { sourceType: item.type, sourceId: item.id },
    },
    create: {
      sourceType: item.type,
      sourceId: item.id,
      title: item.title,
      snippet: makeSnippet(item.description ?? item.title),
      url: item.url,
      publisher: item.publisher,
      thumbnailUrl: item.thumbnailUrl,
      plainText,
    },
    update: {
      title: item.title,
      snippet: makeSnippet(item.description ?? item.title),
      plainText,
    },
  });
}
