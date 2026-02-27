import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ── Helpers (duplicated from src/lib/search-index.ts for standalone script) ──

interface EcfrNode {
  type: string;
  label?: string;
  text?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
  imageCaption?: string;
}

function ecfrNodesToPlainText(contentJson: string): string {
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

function makeSnippet(text: string, maxLen = 300): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

// ── Index Regulations ────────────────────────────────────────────────────────

async function indexRegulations() {
  console.log("Indexing regulations...");
  const sections = await db.cachedSection.findMany({
    select: { id: true, part: true, section: true, title: true, contentJson: true },
  });

  let count = 0;
  for (const s of sections) {
    const plainText = ecfrNodesToPlainText(s.contentJson);
    await db.searchDocument.upsert({
      where: { sourceType_sourceId: { sourceType: "REGULATION", sourceId: s.id } },
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
    count++;
    if (count % 100 === 0) console.log(`  ${count} / ${sections.length}`);
  }
  console.log(`  Indexed ${count} regulation sections`);
}

// ── Index Insights (FMCSA Guidance, Videos, Articles) ────────────────────────

async function indexInsights() {
  console.log("Indexing insights...");
  const insights = await db.insight.findMany({ where: { active: true } });

  let count = 0;
  for (const i of insights) {
    const sourceType =
      i.type === "FMCSA_GUIDANCE" ? "GUIDANCE" : i.type === "VIDEO" ? "VIDEO" : "ARTICLE";
    const plainText = [i.title, i.body ?? ""].join("\n");
    await db.searchDocument.upsert({
      where: { sourceType_sourceId: { sourceType, sourceId: i.id } },
      create: {
        sourceType,
        sourceId: i.id,
        title: i.title,
        snippet: makeSnippet(i.body ?? i.title),
        section: i.sectionIds[0] ?? null,
        part: i.sectionIds[0]?.split(".")[0] ?? null,
        url: i.url,
        publisher: i.publisher,
        thumbnailUrl: i.thumbnailUrl,
        plainText,
      },
      update: {
        title: i.title,
        snippet: makeSnippet(i.body ?? i.title),
        plainText,
      },
    });
    count++;
  }
  console.log(`  Indexed ${count} insights`);
}

// ── Index Feed Items ─────────────────────────────────────────────────────────

async function indexFeedItems() {
  console.log("Indexing feed items...");
  const items = await db.feedItem.findMany();

  let count = 0;
  for (const item of items) {
    const plainText = [item.title, item.description ?? ""].join("\n");
    await db.searchDocument.upsert({
      where: { sourceType_sourceId: { sourceType: item.type, sourceId: item.id } },
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
    count++;
  }
  console.log(`  Indexed ${count} feed items`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Populating search index...\n");
  await indexRegulations();
  await indexInsights();
  await indexFeedItems();
  console.log("\nSearch index population complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
