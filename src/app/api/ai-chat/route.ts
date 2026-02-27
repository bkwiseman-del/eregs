import { NextRequest } from "next/server";
import { auth, canAccessPro } from "@/lib/auth";
import { db } from "@/lib/db";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 30;

const DAILY_LIMIT = 20;
const TOP_K = 8;
const EMBEDDING_MODEL = "text-embedding-3-small";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getQuestionEmbedding(question: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: question }),
  });

  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface EmbeddingRow {
  id: string;
  sourceType: string;
  sourceId: string;
  section: string | null;
  part: string | null;
  title: string;
  chunkText: string;
}

// ── In-memory embedding cache ────────────────────────────────────────────────
// Avoids re-loading 2400+ rows of JSON vectors from the database on every request.

interface EmbeddingCache {
  rows: EmbeddingRow[];
  vectors: number[][];
  loadedAt: number;
}

let embeddingCache: EmbeddingCache | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Pre-warm the cache on module load so first user request is fast
getCachedEmbeddings().catch(() => {});

async function getCachedEmbeddings(): Promise<EmbeddingCache> {
  if (embeddingCache && Date.now() - embeddingCache.loadedAt < CACHE_TTL) {
    return embeddingCache;
  }

  const rawRows: (EmbeddingRow & { embeddingJson: string | null })[] =
    await db.$queryRawUnsafe(
      `SELECT id, "sourceType", "sourceId", section, part, title, "chunkText", "embeddingJson"
       FROM "Embedding"
       WHERE "embeddingJson" IS NOT NULL`
    );

  const rows: EmbeddingRow[] = [];
  const vectors: number[][] = [];

  for (const row of rawRows) {
    if (!row.embeddingJson) continue;
    vectors.push(JSON.parse(row.embeddingJson));
    rows.push({
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      section: row.section,
      part: row.part,
      title: row.title,
      chunkText: row.chunkText,
    });
  }

  embeddingCache = { rows, vectors, loadedAt: Date.now() };
  return embeddingCache;
}

async function findRelevantChunks(questionEmbedding: number[], topK: number) {
  // Check if pgvector is available
  let hasPgVector = false;
  try {
    const ext = await db.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists`
    );
    hasPgVector = ext[0]?.exists ?? false;
  } catch {
    /* ignore */
  }

  if (hasPgVector) {
    const vectorStr = `[${questionEmbedding.join(",")}]`;
    return db.$queryRawUnsafe<(EmbeddingRow & { similarity: number })[]>(
      `SELECT id, "sourceType", "sourceId", section, part, title, "chunkText",
              1 - (embedding <=> $1::vector) AS similarity
       FROM "Embedding"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT ${topK}`,
      vectorStr
    );
  }

  // Fallback: use in-memory cache for fast similarity search
  const cache = await getCachedEmbeddings();
  const topResults: (EmbeddingRow & { similarity: number })[] = [];
  let minTopScore = -1;

  for (let i = 0; i < cache.rows.length; i++) {
    const sim = cosineSimilarity(questionEmbedding, cache.vectors[i]);

    if (topResults.length < topK) {
      topResults.push({ ...cache.rows[i], similarity: sim });
      if (topResults.length === topK) {
        topResults.sort((a, b) => b.similarity - a.similarity);
        minTopScore = topResults[topK - 1].similarity;
      }
    } else if (sim > minTopScore) {
      topResults[topK - 1] = { ...cache.rows[i], similarity: sim };
      topResults.sort((a, b) => b.similarity - a.similarity);
      minTopScore = topResults[topK - 1].similarity;
    }
  }

  topResults.sort((a, b) => b.similarity - a.similarity);
  return topResults;
}

// ── Find related content (videos, articles) via FTS ──────────────────────────

interface ContentResult {
  title: string;
  url: string;
  sourceType: string;
}

async function findRelatedContent(question: string): Promise<ContentResult[]> {
  // Build simple tsquery from question keywords
  const words = question
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["AND", "OR", "NOT", "the", "what", "how", "are", "does", "can", "for", "with"].includes(w.toLowerCase()))
    .slice(0, 5);

  if (words.length === 0) return [];

  const tsquery = words.map((w) => `'${w}':*`).join(" | ");

  try {
    const results: ContentResult[] = await db.$queryRawUnsafe(
      `SELECT title, url, "sourceType"
       FROM "SearchDocument"
       WHERE "searchVector" @@ to_tsquery('english', $1)
         AND "sourceType" IN ('VIDEO', 'ARTICLE', 'PODCAST')
         AND url IS NOT NULL
       ORDER BY ts_rank_cd("searchVector", to_tsquery('english', $1)) DESC
       LIMIT 5`,
      tsquery
    );
    return results;
  } catch {
    return [];
  }
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert regulatory assistant for the Federal Motor Carrier Safety Regulations (FMCSRs) — Title 49 CFR Parts 40, 376, 380-399. You help fleet managers, safety directors, and truck drivers understand regulatory requirements.

RULES:
1. Answer ONLY based on the provided context. If the context does not contain enough information, say so clearly.
2. Use plain, professional language. Avoid legal jargon when possible.
3. Always cite the specific regulation section(s) your answer is based on using markdown links: [§ XXX.X](/regs/XXX.X)
4. When FMCSA Guidance is referenced in the context, cite it with: [FMCSA Guidance on TOPIC](/regs/XXX.X?insights=open) — note that guidance is advisory, not legally binding.
5. If the question is ambiguous, ask for clarification.
6. Do NOT make up or infer regulatory requirements that are not in the provided context.
7. Format your response using markdown: use headers, bullet points, and bold for emphasis.
8. Keep answers concise but thorough. Aim for 2-4 paragraphs unless the topic requires more detail.
9. If RELATED CONTENT (videos, articles) is provided, include a "Related Content" section at the end with markdown links to relevant items.`;

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!canAccessPro(session)) {
    return new Response(
      JSON.stringify({ error: "Pro subscription required" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI service not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Rate limit check
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usageCount = await db.aiChatUsage.count({
    where: { userId: session.user.id, createdAt: { gte: dayAgo } },
  });

  if (usageCount >= DAILY_LIMIT) {
    return new Response(
      JSON.stringify({
        error: "Daily limit reached",
        remaining: 0,
        resetsAt: new Date(
          dayAgo.getTime() + 24 * 60 * 60 * 1000
        ).toISOString(),
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Parse question
  const body = await request.json();
  const question = body.question?.trim();
  if (!question || question.length > 2000) {
    return new Response(JSON.stringify({ error: "Invalid question" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 4. Embed question + find related content in parallel
    const [embedding, relatedContent] = await Promise.all([
      getQuestionEmbedding(question),
      findRelatedContent(question),
    ]);

    // 5. Vector search for regulatory context
    const chunks = await findRelevantChunks(embedding, TOP_K);

    // 6. Look up related insights for cited sections
    const sections = [
      ...new Set(chunks.filter((c) => c.section).map((c) => c.section!)),
    ];
    let insightRefs: { section: string; title: string; type: string }[] = [];
    if (sections.length > 0) {
      const insights = await db.insight.findMany({
        where: {
          active: true,
          sectionIds: { hasSome: sections },
        },
        select: { title: true, type: true, sectionIds: true },
        take: 10,
      });
      insightRefs = insights.map((i) => ({
        section: i.sectionIds[0] ?? "",
        title: i.title.length > 80 ? i.title.slice(0, 80) + "..." : i.title,
        type: i.type,
      }));
    }

    // 7. Build context
    const context = chunks
      .map((c, i) => {
        const source =
          c.sourceType === "REGULATION"
            ? `Regulation § ${c.section}`
            : `FMCSA Guidance (${c.section ?? "general"})`;
        return `--- Source ${i + 1}: ${source} - ${c.title} ---\n${c.chunkText}`;
      })
      .join("\n\n");

    const insightContext =
      insightRefs.length > 0
        ? `\n\nRELATED INSIGHTS AVAILABLE (mention if relevant):\n${insightRefs.map((i) => `- ${i.type}: "${i.title}" (§ ${i.section})`).join("\n")}`
        : "";

    const contentContext =
      relatedContent.length > 0
        ? `\n\nRELATED CONTENT (include as "Related Content" section at end):\n${relatedContent.map((c) => `- ${c.sourceType}: "${c.title}" — ${c.url}`).join("\n")}`
        : "";

    // 8. Record usage
    await db.aiChatUsage.create({
      data: { userId: session.user.id, question },
    });

    // 9. Stream response
    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `REGULATORY CONTEXT:\n${context}${insightContext}${contentContext}\n\nQUESTION: ${question}\n\nProvide a clear, well-cited answer. Use [§ SECTION](/regs/SECTION) for regulation citations and [FMCSA Guidance](/regs/SECTION?insights=open) for guidance references.`,
        },
      ],
    });

    const response = result.toTextStreamResponse();
    response.headers.set(
      "X-Remaining",
      String(DAILY_LIMIT - usageCount - 1)
    );
    return response;
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: "AI chat failed", detail: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
