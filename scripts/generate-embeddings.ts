import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_TOKENS_PER_CHUNK = 500;
const BATCH_SIZE = 100;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required. Set it in .env.local");
  process.exit(1);
}

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function nodeToText(node: EcfrNode): string {
  const parts: string[] = [];
  if (node.label) parts.push(node.label);
  if (node.text) parts.push(node.text);
  if (node.tableHeaders) parts.push(node.tableHeaders.join(" | "));
  if (node.tableRows) parts.push(node.tableRows.map((r) => r.join(" | ")).join("\n"));
  if (node.imageCaption) parts.push(node.imageCaption);
  return parts.join(" ");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkByParagraphs(nodes: EcfrNode[], section: string, title: string): string[] {
  const chunks: string[] = [];
  let current = `§ ${section} ${title}\n`;

  for (const node of nodes) {
    const text = nodeToText(node);
    if (!text.trim()) continue;

    if (estimateTokens(current + text) > MAX_TOKENS_PER_CHUNK && current.trim().length > 50) {
      chunks.push(current.trim());
      current = `§ ${section} ${title} (continued)\n`;
    }
    current += text + "\n";
  }

  if (current.trim().length > 50) {
    chunks.push(current.trim());
  }

  return chunks;
}

function chunkText(text: string, title: string): string[] {
  if (estimateTokens(text) <= MAX_TOKENS_PER_CHUNK) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = title + "\n";

  for (const sentence of sentences) {
    if (estimateTokens(current + sentence) > MAX_TOKENS_PER_CHUNK && current.trim().length > 50) {
      chunks.push(current.trim());
      current = title + " (continued)\n";
    }
    current += sentence + " ";
  }

  if (current.trim().length > 50) chunks.push(current.trim());
  return chunks;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

// ── Detect pgvector support ──────────────────────────────────────────────────

async function hasPgVector(): Promise<boolean> {
  try {
    const result = await db.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists`
    );
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

// ── Embed Regulations ────────────────────────────────────────────────────────

async function embedRegulations(useVector: boolean) {
  console.log("Generating embeddings for regulations...");
  const sections = await db.cachedSection.findMany({
    select: { id: true, part: true, section: true, title: true, contentJson: true },
  });

  const allChunks: {
    sourceId: string;
    section: string;
    part: string;
    title: string;
    chunkIndex: number;
    chunkText: string;
  }[] = [];

  for (const s of sections) {
    let nodes: EcfrNode[];
    try {
      nodes = JSON.parse(s.contentJson);
    } catch {
      continue;
    }
    const chunks = chunkByParagraphs(nodes, s.section, s.title);
    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        sourceId: s.id,
        section: s.section,
        part: s.part,
        title: `§ ${s.section} ${s.title}`,
        chunkIndex: i,
        chunkText: chunks[i],
      });
    }
  }

  console.log(`  ${allChunks.length} chunks from ${sections.length} sections`);

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.chunkText);
    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embeddingArr = embeddings[j];

      await db.embedding.upsert({
        where: {
          sourceType_sourceId_chunkIndex: {
            sourceType: "REGULATION",
            sourceId: chunk.sourceId,
            chunkIndex: chunk.chunkIndex,
          },
        },
        create: {
          sourceType: "REGULATION",
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          section: chunk.section,
          part: chunk.part,
          title: chunk.title,
          chunkText: chunk.chunkText,
        },
        update: { chunkText: chunk.chunkText, title: chunk.title },
      });

      if (useVector) {
        const vectorStr = `[${embeddingArr.join(",")}]`;
        await db.$executeRawUnsafe(
          `UPDATE "Embedding" SET embedding = $1::vector
           WHERE "sourceType" = 'REGULATION' AND "sourceId" = $2 AND "chunkIndex" = $3`,
          vectorStr,
          chunk.sourceId,
          chunk.chunkIndex
        );
      } else {
        // Fallback: store as JSON text
        await db.$executeRawUnsafe(
          `UPDATE "Embedding" SET "embeddingJson" = $1
           WHERE "sourceType" = 'REGULATION' AND "sourceId" = $2 AND "chunkIndex" = $3`,
          JSON.stringify(embeddingArr),
          chunk.sourceId,
          chunk.chunkIndex
        );
      }
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, allChunks.length)} / ${allChunks.length}`);
    if (i + BATCH_SIZE < allChunks.length) await new Promise((r) => setTimeout(r, 200));
  }
}

// ── Embed Guidance ───────────────────────────────────────────────────────────

async function embedGuidance(useVector: boolean) {
  console.log("Generating embeddings for FMCSA guidance...");
  const insights = await db.insight.findMany({
    where: { type: "FMCSA_GUIDANCE", active: true },
  });

  const allChunks: {
    sourceId: string;
    section: string | null;
    part: string | null;
    title: string;
    chunkIndex: number;
    chunkText: string;
  }[] = [];

  for (const ins of insights) {
    const fullText = `${ins.title}\n${ins.body ?? ""}`;
    const chunks = chunkText(fullText, ins.title);
    for (let idx = 0; idx < chunks.length; idx++) {
      allChunks.push({
        sourceId: ins.id,
        section: ins.sectionIds[0] ?? null,
        part: ins.sectionIds[0]?.split(".")[0] ?? null,
        title: ins.title,
        chunkIndex: idx,
        chunkText: chunks[idx],
      });
    }
  }

  console.log(`  ${allChunks.length} chunks from ${insights.length} guidance entries`);

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.chunkText);
    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embeddingArr = embeddings[j];

      await db.embedding.upsert({
        where: {
          sourceType_sourceId_chunkIndex: {
            sourceType: "GUIDANCE",
            sourceId: chunk.sourceId,
            chunkIndex: chunk.chunkIndex,
          },
        },
        create: {
          sourceType: "GUIDANCE",
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          section: chunk.section,
          part: chunk.part,
          title: chunk.title,
          chunkText: chunk.chunkText,
        },
        update: { chunkText: chunk.chunkText, title: chunk.title },
      });

      if (useVector) {
        const vectorStr = `[${embeddingArr.join(",")}]`;
        await db.$executeRawUnsafe(
          `UPDATE "Embedding" SET embedding = $1::vector
           WHERE "sourceType" = 'GUIDANCE' AND "sourceId" = $2 AND "chunkIndex" = $3`,
          vectorStr,
          chunk.sourceId,
          chunk.chunkIndex
        );
      } else {
        await db.$executeRawUnsafe(
          `UPDATE "Embedding" SET "embeddingJson" = $1
           WHERE "sourceType" = 'GUIDANCE' AND "sourceId" = $2 AND "chunkIndex" = $3`,
          JSON.stringify(embeddingArr),
          chunk.sourceId,
          chunk.chunkIndex
        );
      }
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, allChunks.length)} / ${allChunks.length}`);
    if (i + BATCH_SIZE < allChunks.length) await new Promise((r) => setTimeout(r, 200));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const useVector = await hasPgVector();
  console.log(
    useVector
      ? "Using pgvector for embedding storage"
      : "Using JSON text fallback for embedding storage (pgvector not available)"
  );
  console.log();

  await embedRegulations(useVector);
  await embedGuidance(useVector);

  const total = await db.embedding.count();
  console.log(`\nEmbedding generation complete! ${total} total chunks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
