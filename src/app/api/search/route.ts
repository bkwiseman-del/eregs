import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, canAccessPro } from "@/lib/auth";
import { makeParagraphId } from "@/lib/annotations";

// Convert user query to PostgreSQL tsquery syntax
// Supports: "quoted phrases", AND, OR, NOT, and bare terms (default AND)
function parseQuery(input: string): string {
  const tokens: string[] = [];
  const re = /"([^"]+)"|(\bAND\b)|(\bOR\b)|(\bNOT\b)|(\S+)/gi;
  let match;
  let lastWasOperator = true;

  while ((match = re.exec(input)) !== null) {
    if (match[1]) {
      // Quoted phrase → use <-> (phrase match)
      const words = match[1]
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (words.length > 0) {
        if (!lastWasOperator && tokens.length > 0) tokens.push("&");
        tokens.push(words.map((w) => `'${w.replace(/'/g, "")}'`).join(" <-> "));
        lastWasOperator = false;
      }
    } else if (match[2]) {
      tokens.push("&");
      lastWasOperator = true;
    } else if (match[3]) {
      tokens.push("|");
      lastWasOperator = true;
    } else if (match[4]) {
      tokens.push("!");
      lastWasOperator = true;
    } else if (match[5]) {
      // Split on hyphens/slashes so "short-haul" → "short" & "haul"
      const parts = match[5]
        .split(/[-/]/)
        .map((p) => p.replace(/[^a-zA-Z0-9§.]/g, ""))
        .filter(Boolean);
      for (let pi = 0; pi < parts.length; pi++) {
        if (!lastWasOperator && tokens.length > 0) tokens.push("&");
        tokens.push(`'${parts[pi]}':*`);
        lastWasOperator = false;
      }
    }
  }

  return tokens.join(" ") || "";
}

// Map type param to sourceType values
const TYPE_MAP: Record<string, string[]> = {
  REGULATION: ["REGULATION"],
  GUIDANCE: ["GUIDANCE"],
  CONTENT: ["VIDEO", "ARTICLE", "PODCAST"],
  VIDEO: ["VIDEO"],
  ARTICLE: ["ARTICLE"],
  PODCAST: ["PODCAST"],
};

// Types that require Pro access
const PRO_TYPES = new Set(["GUIDANCE", "CONTENT", "VIDEO", "ARTICLE", "PODCAST"]);

interface EcfrNode {
  type: string;
  label?: string;
  text?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

// Find the best-matching paragraph ID for a regulation search result
function findMatchingParagraph(
  contentJson: string,
  section: string,
  queryTerms: string[]
): string | null {
  try {
    const nodes: EcfrNode[] = JSON.parse(contentJson);
    const lowerTerms = queryTerms.map((t) => t.toLowerCase());

    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const text = (node.text ?? "").toLowerCase();
      if (!text) continue;

      let score = 0;
      for (const term of lowerTerms) {
        if (text.includes(term)) score++;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const node = nodes[bestIdx];
      return makeParagraphId(section, node.label, bestIdx);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const typeFilter = request.nextUrl.searchParams.get("type")?.toUpperCase();
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "20"),
    50
  );
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  // Auth-aware access control
  const session = await auth();
  const isPro = session ? canAccessPro(session) : false;

  // Check if user is requesting Pro-only types
  if (typeFilter && PRO_TYPES.has(typeFilter) && !isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for this content type" },
      { status: 403 }
    );
  }

  const tsquery = parseQuery(q);
  if (!tsquery) {
    return NextResponse.json({ results: [], total: 0, facets: {}, hasMore: false, isPro });
  }

  try {
    // Build type filter clause
    let allowedTypes: string[];
    if (typeFilter && TYPE_MAP[typeFilter]) {
      allowedTypes = TYPE_MAP[typeFilter];
    } else if (isPro) {
      allowedTypes = ["REGULATION", "GUIDANCE", "VIDEO", "ARTICLE", "PODCAST"];
    } else {
      // Free users only see regulations
      allowedTypes = ["REGULATION"];
    }

    const typePlaceholders = allowedTypes
      .map((_, i) => `$${i + 2}`)
      .join(", ");

    // Execute search with ranking and headline
    // Limit/offset are inlined (already sanitized as parseInt above)
    const results = await db.$queryRawUnsafe(
      `SELECT
        id, "sourceType", "sourceId", title, snippet, section, part, url, publisher, "thumbnailUrl",
        ts_rank_cd("searchVector", to_tsquery('english', $1), 32) AS rank,
        ts_headline('english', "plainText", to_tsquery('english', $1),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter= … '
        ) AS headline
      FROM "SearchDocument"
      WHERE "searchVector" @@ to_tsquery('english', $1)
        AND "sourceType" IN (${typePlaceholders})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}`,
      tsquery,
      ...allowedTypes
    );

    // Get total count
    const countResult: { total: number }[] = await db.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM "SearchDocument"
       WHERE "searchVector" @@ to_tsquery('english', $1)
         AND "sourceType" IN (${typePlaceholders})`,
      tsquery,
      ...allowedTypes
    );
    const total = countResult[0]?.total ?? 0;

    // Get facet counts (for all types the user has access to)
    const allAccessible = isPro
      ? ["REGULATION", "GUIDANCE", "VIDEO", "ARTICLE", "PODCAST"]
      : ["REGULATION"];
    const facetPlaceholders2 = allAccessible
      .map((_, i) => `$${i + 2}`)
      .join(", ");
    const facetResult: { sourceType: string; count: number }[] =
      await db.$queryRawUnsafe(
        `SELECT "sourceType", COUNT(*)::int AS count
         FROM "SearchDocument"
         WHERE "searchVector" @@ to_tsquery('english', $1)
           AND "sourceType" IN (${facetPlaceholders2})
         GROUP BY "sourceType"`,
        tsquery,
        ...allAccessible
      );
    const facets: Record<string, number> = {};
    for (const f of facetResult) facets[f.sourceType] = f.count;

    // Deep-link: find matching paragraphs for regulation results
    const typedResults = results as Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      title: string;
      snippet: string;
      section: string | null;
      part: string | null;
      url: string | null;
      publisher: string | null;
      thumbnailUrl: string | null;
      rank: number;
      headline: string;
      paragraphId?: string | null;
    }>;

    // Extract query terms for paragraph matching
    const queryTerms = q
      .replace(/["()]/g, "")
      .split(/\s+/)
      .filter(
        (t) => t.length > 2 && !["AND", "OR", "NOT"].includes(t.toUpperCase())
      );

    // Batch-fetch CachedSection data for regulation results
    const regResults = typedResults.filter(
      (r) => r.sourceType === "REGULATION" && r.section
    );
    if (regResults.length > 0) {
      const sectionIds = regResults.map((r) => r.section!);
      const cachedSections = await db.cachedSection.findMany({
        where: { section: { in: sectionIds } },
        select: { section: true, contentJson: true },
      });
      const sectionMap = new Map(cachedSections.map((s) => [s.section, s.contentJson]));

      for (const r of regResults) {
        const contentJson = sectionMap.get(r.section!);
        if (contentJson) {
          r.paragraphId = findMatchingParagraph(contentJson, r.section!, queryTerms);
        }
      }
    }

    return NextResponse.json({
      results: typedResults,
      total,
      facets,
      hasMore: offset + limit < total,
      isPro,
      query: q,
    });
  } catch (e) {
    console.error("search error:", e);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
