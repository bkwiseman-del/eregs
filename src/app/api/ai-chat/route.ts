import { NextRequest } from "next/server";
import { auth, canAccessPro } from "@/lib/auth";
import { db } from "@/lib/db";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 30;

const DAILY_LIMIT = 20;
const TOP_K = 14;
const EMBEDDING_MODEL = "text-embedding-3-small";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must", "ought",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
  "they", "them", "their", "this", "that", "these", "those", "what",
  "which", "who", "whom", "how", "when", "where", "why",
  "and", "or", "but", "nor", "not", "so", "yet", "both", "either",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "over", "if", "then", "than", "too", "very",
  "just", "also", "more", "most", "some", "any", "all", "each",
]);

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
// Stores rows + vectors + lowercased chunkText for keyword search.

interface EmbeddingCache {
  rows: EmbeddingRow[];
  vectors: number[][];
  textLower: string[]; // lowercased chunkText for keyword search
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
  const textLower: string[] = [];

  for (const row of rawRows) {
    if (!row.embeddingJson) continue;
    vectors.push(JSON.parse(row.embeddingJson));
    textLower.push((row.title + " " + row.chunkText).toLowerCase());
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

  embeddingCache = { rows, vectors, textLower, loadedAt: Date.now() };
  return embeddingCache;
}

// ── Topic expansion: map abbreviations/topics to full terms + relevant parts ──

interface TopicExpansion {
  terms: string[];
  parts: string[];
  requiredSections?: string[]; // Sections that MUST appear in results for this topic
}

const TOPIC_MAP: Record<string, TopicExpansion> = {
  hos: { terms: ["hours of service", "driving time", "on-duty", "off-duty", "sleeper berth"], parts: ["395"], requiredSections: ["395.1", "395.3", "395.5"] },
  "hours of service": { terms: ["driving time", "on-duty", "off-duty", "sleeper berth", "hours"], parts: ["395"], requiredSections: ["395.1", "395.3", "395.5"] },
  "driving time": { terms: ["hours of service", "on-duty", "driving"], parts: ["395"], requiredSections: ["395.3", "395.5"] },
  eld: { terms: ["electronic logging device", "hours of service", "recording device"], parts: ["395"], requiredSections: ["395.8", "395.22"] },
  drug: { terms: ["controlled substances", "drug testing", "alcohol testing"], parts: ["382"], requiredSections: ["382.301", "382.303"] },
  alcohol: { terms: ["controlled substances", "drug testing", "alcohol testing"], parts: ["382"], requiredSections: ["382.301", "382.303"] },
  qualification: { terms: ["driver qualification", "physical qualification", "medical examiner"], parts: ["391"], requiredSections: ["391.41", "391.43", "391.45"] },
  dq: { terms: ["driver qualification", "physical qualification"], parts: ["391"], requiredSections: ["391.41", "391.43"] },
  cdl: { terms: ["commercial driver license", "knowledge test", "skills test"], parts: ["383"] },
  hazmat: { terms: ["hazardous materials", "placarding", "hazmat"], parts: ["397"] },
  insurance: { terms: ["financial responsibility", "surety bond", "insurance"], parts: ["387"] },
  inspection: { terms: ["vehicle inspection", "parts and accessories", "maintenance"], parts: ["393", "396"] },
  maintenance: { terms: ["vehicle inspection", "parts and accessories", "systematic inspection"], parts: ["396"] },
  brakes: { terms: ["brake", "stopping distance", "parking brake"], parts: ["393"] },
  passenger: { terms: ["passenger carrier", "passenger carrying", "for-hire"], parts: ["395"], requiredSections: ["395.1", "395.5"] },
  "short haul": { terms: ["short-haul", "150 air-mile", "air-mile radius"], parts: ["395"], requiredSections: ["395.1"] },
};

// Sections that are appendices/reference tables — exclude from retrieval
function isAppendixSection(section: string | null): boolean {
  if (!section) return false;
  return section.includes("-app") || section.includes("App");
}

function expandQuery(question: string): { keywords: string[]; boostParts: string[]; requiredSections: string[] } {
  const qLower = question.toLowerCase();
  const baseKeywords = qLower
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const expandedTerms = new Set(baseKeywords);
  const boostParts = new Set<string>();
  const requiredSections = new Set<string>();

  // Check for topic matches in the full question text
  for (const [topic, expansion] of Object.entries(TOPIC_MAP)) {
    if (qLower.includes(topic)) {
      for (const term of expansion.terms) expandedTerms.add(term);
      for (const part of expansion.parts) boostParts.add(part);
      if (expansion.requiredSections) {
        for (const sec of expansion.requiredSections) requiredSections.add(sec);
      }
    }
  }

  // Also check individual keywords
  for (const kw of baseKeywords) {
    const expansion = TOPIC_MAP[kw];
    if (expansion) {
      for (const term of expansion.terms) expandedTerms.add(term);
      for (const part of expansion.parts) boostParts.add(part);
      if (expansion.requiredSections) {
        for (const sec of expansion.requiredSections) requiredSections.add(sec);
      }
    }
  }

  return { keywords: [...expandedTerms], boostParts: [...boostParts], requiredSections: [...requiredSections] };
}

// ── Hybrid retrieval: vector + keyword + title-match + part-boost with RRF ────

async function findRelevantChunksHybrid(
  questionEmbedding: number[],
  question: string,
  topK: number
): Promise<(EmbeddingRow & { similarity: number })[]> {
  const cache = await getCachedEmbeddings();
  const { keywords, boostParts, requiredSections } = expandQuery(question);
  const RRF_K = 60; // Reciprocal Rank Fusion constant
  const candidateCount = topK * 3;

  // Pre-filter: exclude appendix sections (reference tables, not operative regulation)
  const validIndices: number[] = [];
  for (let i = 0; i < cache.rows.length; i++) {
    if (!isAppendixSection(cache.rows[i].section)) validIndices.push(i);
  }

  // 1. Vector search — score valid chunks, keep top N
  const vectorScored: { idx: number; sim: number }[] = [];
  for (const i of validIndices) {
    const sim = cosineSimilarity(questionEmbedding, cache.vectors[i]);
    vectorScored.push({ idx: i, sim });
  }
  vectorScored.sort((a, b) => b.sim - a.sim);
  const vectorTop = vectorScored.slice(0, candidateCount);

  // 2. Keyword search — match expanded keywords against chunk text
  const keywordScored: { idx: number; matchCount: number }[] = [];
  if (keywords.length > 0) {
    for (const i of validIndices) {
      const text = cache.textLower[i];
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }
      if (matchCount > 0) {
        keywordScored.push({ idx: i, matchCount });
      }
    }
    keywordScored.sort((a, b) => b.matchCount - a.matchCount);
  }
  const keywordTop = keywordScored.slice(0, candidateCount);

  // 3. Title-match search — chunks whose TITLE matches keywords get extra signal
  const titleScored: { idx: number; titleHits: number }[] = [];
  if (keywords.length > 0) {
    for (const i of validIndices) {
      const titleLower = cache.rows[i].title.toLowerCase();
      let titleHits = 0;
      for (const kw of keywords) {
        if (titleLower.includes(kw)) titleHits++;
      }
      if (titleHits > 0) titleScored.push({ idx: i, titleHits });
    }
    titleScored.sort((a, b) => b.titleHits - a.titleHits);
  }
  const titleTop = titleScored.slice(0, candidateCount);

  // 4. Part-boosted search — top chunks from topically relevant parts
  const partBoosted: { idx: number }[] = [];
  if (boostParts.length > 0) {
    const partChunks = vectorScored
      .filter(({ idx }) => {
        const part = cache.rows[idx].part;
        return part && boostParts.includes(part);
      })
      .slice(0, candidateCount);
    partBoosted.push(...partChunks);
  }

  // 5. Reciprocal Rank Fusion — combine all four rankings
  const rrfScores = new Map<number, number>();

  vectorTop.forEach(({ idx }, rank) => {
    rrfScores.set(idx, (rrfScores.get(idx) ?? 0) + 1 / (RRF_K + rank));
  });

  keywordTop.forEach(({ idx }, rank) => {
    rrfScores.set(idx, (rrfScores.get(idx) ?? 0) + 1 / (RRF_K + rank));
  });

  // Title matches get 1.5x weight — a title match is a strong relevance signal
  titleTop.forEach(({ idx }, rank) => {
    rrfScores.set(idx, (rrfScores.get(idx) ?? 0) + 1.5 / (RRF_K + rank));
  });

  partBoosted.forEach(({ idx }, rank) => {
    rrfScores.set(idx, (rrfScores.get(idx) ?? 0) + 1 / (RRF_K + rank));
  });

  // 6. Sort by RRF score, then apply section diversity
  const sorted = [...rrfScores.entries()].sort((a, b) => b[1] - a[1]);
  const vectorSimMap = new Map(vectorTop.map((v) => [v.idx, v.sim]));
  const boostPartsSet = new Set(boostParts);
  const MAX_PER_SECTION_BOOSTED = 3; // Core topic sections get more slots
  const MAX_PER_SECTION_OTHER = 1;   // Non-core sections get fewer
  const sectionCounts = new Map<string, number>();
  const results: (EmbeddingRow & { similarity: number })[] = [];
  const resultSections = new Set<string>();

  for (const [idx] of sorted) {
    if (results.length >= topK + 6) break;
    const row = cache.rows[idx];
    const secKey = row.section ?? row.part ?? "unknown";
    const count = sectionCounts.get(secKey) ?? 0;
    const isBoostedPart = row.part != null && boostPartsSet.has(row.part);
    const maxForSection = isBoostedPart ? MAX_PER_SECTION_BOOSTED : MAX_PER_SECTION_OTHER;
    if (count >= maxForSection) continue;
    sectionCounts.set(secKey, count + 1);
    results.push({ ...row, similarity: vectorSimMap.get(idx) ?? 0 });
    if (row.section) resultSections.add(row.section);
  }

  // 7. Ensure required sections have at least 1 chunk in results
  if (requiredSections.length > 0) {
    for (const reqSec of requiredSections) {
      if (resultSections.has(reqSec)) continue;
      // Find best chunk for this section from the vector-scored pool
      const best = vectorScored.find(
        ({ idx }) => cache.rows[idx].section === reqSec && cache.rows[idx].sourceType === "REGULATION"
      );
      if (best) {
        const row = cache.rows[best.idx];
        results.push({ ...row, similarity: best.sim });
        resultSections.add(reqSec);
      }
    }
  }

  return results;
}

// ── Section ID cleanup (strip appendix suffixes for valid links) ─────────────

function cleanSectionId(section: string | null): string | null {
  if (!section) return null;
  // "390-appA" → "390.3" isn't possible, so strip appendix sections from links
  // They generate 404s. Return null to omit from links.
  if (section.includes("-app") || section.includes("App")) return null;
  return section;
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

SOURCE HIERARCHY (critical — you MUST follow this):
- The CURRENT REGULATORY TEXT section is the authoritative, legally binding source of truth. ALL specific numbers (distances, hours, time limits, thresholds) MUST come from the regulatory text. Always base your answer on regulation text first.
- FMCSA Guidance is advisory and interpretive only — it is NOT legally binding. FMCSA guidance may reference OUTDATED rule versions with old numbers that have since been amended. If guidance mentions different numbers or requirements than the regulatory text, ALWAYS use the regulatory text numbers and IGNORE the guidance numbers. You may reference guidance for interpretive context but never for specific regulatory requirements.
- Related content (videos, articles) is supplementary educational material only.

LINK FORMAT (critical — you MUST follow this exactly):
- Regulation citations: [§ 395.1](/regs/395.1) — always use /regs/SECTION format
- Guidance citations: [FMCSA Guidance on HOS](/regs/395.1?insights=open) — always use /regs/SECTION?insights=open
- NEVER use external URLs like https://www.ecfr.gov/... or https://www.fmcsa.dot.gov/... for regulation or guidance links
- The ONLY external URLs allowed are those provided in the RELATED CONTENT section for videos/articles

CORRECT: [§ 395.1(e)](/regs/395.1)
CORRECT: [FMCSA Guidance](/regs/395.1?insights=open)
WRONG: [§ 395.1(e)](https://www.ecfr.gov/current/title-49/section-395.1)
WRONG: [FMCSA Guidance](https://www.fmcsa.dot.gov/hours-service)

RULES:
1. Answer ONLY based on the provided context. If the context does not contain enough information, say so clearly.
2. Use plain, professional language. Avoid legal jargon when possible.
3. If the question is ambiguous, ask for clarification.
4. Do NOT make up or infer regulatory requirements that are not in the provided context.
5. Format your response using markdown: use headers, bullet points, and bold for emphasis.
6. Keep answers concise but thorough. Aim for 2-4 paragraphs unless the topic requires more detail.
7. If RELATED CONTENT (videos, articles) is provided, include a "Related Content" section at the end. Use the exact URLs provided for content links — these are the only external links you should use.
8. When referencing FMCSA Guidance, always note it is advisory, not legally binding.
9. If FMCSA GUIDANCE AVAILABLE is listed in the context, you MUST include an "## FMCSA Guidance" section in your response that mentions the relevant guidance topics and links to them using [FMCSA Guidance on TOPIC](/regs/SECTION?insights=open) format. This section should briefly describe what additional interpretive detail the guidance covers and note that it is advisory.

CITATION REQUIREMENTS (critical — you MUST follow these):
10. EVERY specific regulatory claim (a number, threshold, distance, time limit, requirement, or prohibition) MUST be immediately followed by an inline citation in the format [§ SECTION](/regs/SECTION). For example: "Drivers may not drive more than 11 hours [§ 395.3](/regs/395.3)."
11. You MUST end your answer with a "## Sources" section listing every regulation section you cited, formatted as a bulleted list of links. Example:
    ## Sources
    - [§ 395.1 — Scope and applicability](/regs/395.1)
    - [§ 395.3 — Maximum driving time](/regs/395.3)
12. If you cannot find a regulation section to cite for a claim, do NOT include that claim. Never state regulatory requirements without a citation.`;

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

    // 5. Hybrid search (vector + keyword) with RRF merging
    const rawChunks = await findRelevantChunksHybrid(embedding, question, TOP_K);

    // Separate and re-merge: take all regulation chunks + top guidance
    const regRaw = rawChunks.filter((c) => c.sourceType === "REGULATION");
    const guidRaw = rawChunks.filter((c) => c.sourceType !== "REGULATION");
    const guidanceSlots = Math.max(3, TOP_K - regRaw.length);
    const chunks = [...regRaw, ...guidRaw.slice(0, guidanceSlots)];

    // 6. Look up related insights for cited sections (skip appendix sections)
    const sections = [
      ...new Set(
        chunks
          .map((c) => cleanSectionId(c.section))
          .filter((s): s is string => s !== null)
      ),
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

    // 7. Build context — ONLY regulation text gets full inclusion.
    //    Guidance text is excluded from context because it often contains
    //    outdated numbers (e.g., pre-2020 "100 air miles" vs current "150").
    //    Instead, guidance is referenced by title only so the model knows
    //    it exists and can point users to it.
    const regChunks = chunks.filter((c) => c.sourceType === "REGULATION");
    const guidanceChunks = chunks.filter((c) => c.sourceType !== "REGULATION");

    let context = "=== CURRENT REGULATORY TEXT ===\n\n";
    context += regChunks
      .map((c) => {
        const cleanId = cleanSectionId(c.section);
        const label = cleanId ? `§ ${cleanId}` : c.part ? `Part ${c.part}` : "General";
        return `--- ${label} - ${c.title} ---\n${c.chunkText}`;
      })
      .join("\n\n");

    // Guidance: titles only (no full text — avoids outdated numbers polluting answers)
    const guidanceTitles = guidanceChunks
      .map((c) => {
        const cleanId = cleanSectionId(c.section);
        return `- "${c.title}" (${cleanId ? `§ ${cleanId}` : "general"})`;
      })
      .slice(0, 5);
    const allInsightTitles = [
      ...guidanceTitles,
      ...insightRefs.map((i) => `- ${i.type}: "${i.title}" (§ ${i.section})`),
    ];
    // Deduplicate by title
    const seenTitles = new Set<string>();
    const uniqueInsights = allInsightTitles.filter((t) => {
      if (seenTitles.has(t)) return false;
      seenTitles.add(t);
      return true;
    });

    const insightContext =
      uniqueInsights.length > 0
        ? `\n\n=== FMCSA GUIDANCE AVAILABLE ===\nThe following FMCSA guidance topics are relevant. You MUST include an "## FMCSA Guidance" section in your answer that references these topics and links to them. These are advisory and not legally binding.\n${uniqueInsights.join("\n")}`
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
      model: openai("gpt-4o"),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${context}${insightContext}${contentContext}\n\nQUESTION: ${question}\n\nIMPORTANT REMINDERS:\n- All specific numbers, distances, hours, and thresholds MUST come from the CURRENT REGULATORY TEXT section above. If the FMCSA GUIDANCE section mentions different numbers, those are outdated — use ONLY the regulatory text values.\n- Use internal links: [§ SECTION](/regs/SECTION) for regulations and [FMCSA Guidance](/regs/SECTION?insights=open) for guidance. Never link to ecfr.gov.\n- EVERY regulatory claim MUST have an inline citation like [§ 395.1](/regs/395.1) immediately after it.\n- You MUST end with a "## Sources" section listing all cited regulation sections as links.`,
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
