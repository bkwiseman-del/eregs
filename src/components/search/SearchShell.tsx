"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BodyScrollLock } from "@/components/shared/BodyScrollLock";
import { AppNav } from "@/components/shared/AppNav";
import { NavRail } from "@/components/reader/NavRail";
import { MobileBottomTabs } from "@/components/shared/MobileBottomTabs";
import { AiChat } from "./AiChat";

// ── Hooks ────────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
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
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: Record<string, number>;
  hasMore: boolean;
  isPro: boolean;
}

type FilterType = "ALL" | "REGULATION" | "GUIDANCE" | "CONTENT";

// ── Icons ────────────────────────────────────────────────────────────────────

const searchIcon = (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const sparkleIcon = (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M9.5 2l.5 4 4 .5-4 .5-.5 4-.5-4-4-.5 4-.5z" />
    <path d="M17 12l.5 3 3 .5-3 .5-.5 3-.5-3-3-.5 3-.5z" />
  </svg>
);

const bookIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const infoIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const playIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const documentIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const lockIcon = (
  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ── Filter config ────────────────────────────────────────────────────────────

const filters: { label: string; value: FilterType; icon: React.ReactNode; proOnly?: boolean }[] = [
  { label: "All", value: "ALL", icon: null },
  { label: "Regulations", value: "REGULATION", icon: bookIcon },
  { label: "Guidance", value: "GUIDANCE", icon: infoIcon, proOnly: true },
  { label: "Content", value: "CONTENT", icon: playIcon, proOnly: true },
];

// ── Component ────────────────────────────────────────────────────────────────

// ── Session cache (survives remounts when navigating away and back) ──────────

interface SearchCache {
  query: string;
  filter: FilterType;
  results: SearchResult[];
  total: number;
  facets: Record<string, number>;
  hasMore: boolean;
}

let searchCache: SearchCache | null = null;

export function SearchShell({ isPaid, isFleet = false, userName }: { isPaid: boolean; isFleet?: boolean; userName: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // Restore from URL params first, then fall back to cache
  const urlQ = searchParams.get("q");
  const urlType = searchParams.get("type")?.toUpperCase() as FilterType | undefined;

  // State — initialize from cache if returning to page
  const [query, setQuery] = useState(urlQ ?? searchCache?.query ?? "");
  const [filter, setFilter] = useState<FilterType>(urlType || searchCache?.filter || "ALL");
  const [aiMode, setAiMode] = useState(searchParams.get("mode") === "ai");
  const [results, setResults] = useState<SearchResult[]>(searchCache?.results ?? []);
  const [total, setTotal] = useState(searchCache?.total ?? 0);
  const [facets, setFacets] = useState<Record<string, number>>(searchCache?.facets ?? {});
  const [hasMore, setHasMore] = useState(searchCache?.hasMore ?? false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(searchCache ? searchCache.results.length > 0 || !!searchCache.query : false);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiChatRef = useRef<{ submitQuestion: (q: string) => void }>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Persist search state to module cache on changes
  useEffect(() => {
    if (!aiMode) {
      searchCache = { query, filter, results, total, facets, hasMore };
    }
  }, [query, filter, results, total, facets, hasMore, aiMode]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current && !aiMode) {
      inputRef.current.focus();
    }
  }, [aiMode]);

  // Search function
  const doSearch = useCallback(
    async (q: string, type: FilterType, offset = 0, append = false) => {
      if (!q.trim()) {
        if (!append) {
          setResults([]);
          setTotal(0);
          setFacets({});
          setHasMore(false);
          setSearched(false);
        }
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          limit: "20",
          offset: String(offset),
        });
        if (type !== "ALL") params.set("type", type);

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error("Search failed");

        const data: SearchResponse = await res.json();
        setResults(append ? (prev) => [...prev, ...data.results] : data.results);
        setTotal(data.total);
        setFacets(data.facets);
        setHasMore(data.hasMore);
        setSearched(true);
      } catch {
        if (!append) {
          setResults([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update URL and trigger search on query/filter change
  useEffect(() => {
    if (aiMode) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Update URL
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filter !== "ALL") params.set("type", filter);
      const url = params.toString() ? `/search?${params}` : "/search";
      window.history.replaceState(null, "", url);

      doSearch(query, filter);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, filter, aiMode, doSearch]);

  // Handle AI mode toggle
  const toggleAiMode = () => {
    const next = !aiMode;
    setAiMode(next);
    if (next) {
      window.history.replaceState(null, "", "/search?mode=ai");
    } else {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      window.history.replaceState(null, "", params.toString() ? `/search?${params}` : "/search");
    }
  };

  // Handle input submit (Enter key)
  const handleSubmit = () => {
    if (aiMode && query.trim()) {
      // Submit to AI chat
      aiChatRef.current?.submitQuestion(query);
      setQuery("");
    } else {
      doSearch(query, filter);
    }
  };

  // Facet count helpers
  const totalCount = Object.values(facets).reduce((a, b) => a + b, 0);
  const guidanceCount = facets["GUIDANCE"] ?? 0;
  const contentCount =
    (facets["VIDEO"] ?? 0) + (facets["ARTICLE"] ?? 0) + (facets["PODCAST"] ?? 0);

  function getFilterCount(f: FilterType): number {
    if (f === "ALL") return totalCount;
    if (f === "REGULATION") return facets["REGULATION"] ?? 0;
    if (f === "GUIDANCE") return guidanceCount;
    if (f === "CONTENT") return contentCount;
    return 0;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <BodyScrollLock />
      {/* AppNav with search input */}
      <AppNav
        isMobile={isMobile}
        searchValue={query}
        onSearchChange={setQuery}
        onSearchSubmit={handleSubmit}
        aiMode={aiMode}
        onToggleAi={toggleAiMode}
        isPro={isPaid}
        mobileCenter={
          isMobile ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0 10px",
                height: 34,
              }}
            >
              <span style={{ color: "var(--text3)", flexShrink: 0 }}>{searchIcon}</span>
              <input
                ref={inputRef}
                type="text"
                placeholder={aiMode ? "Ask a regulatory question…" : "Search regulations…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  fontSize: 14,
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", color: "var(--text3)" }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <button
                onClick={toggleAiMode}
                title={aiMode ? "Switch to search" : "Ask AI"}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 2,
                  cursor: "pointer",
                  color: aiMode ? "var(--accent)" : "var(--text3)",
                  opacity: !isPaid && !aiMode ? 0.4 : 1,
                }}
              >
                {!isPaid ? lockIcon : sparkleIcon}
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Body */}
      <div
        style={{
          position: "fixed",
          top: "var(--nav-h)",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {!isMobile && <NavRail isPaid={isPaid} isFleet={isFleet} />}

        <main
          style={{
            flex: 1,
            overflowY: aiMode ? "hidden" : "auto",
            minWidth: 0,
            minHeight: 0,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ maxWidth: 740, width: "100%", margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {aiMode ? (
              // ── AI Chat Mode ──
              <AiChatWrapper isPaid={isPaid} ref={aiChatRef} />
            ) : (
              // ── Search Mode ──
              <>
                {/* Filter pills */}
                {searched && (
                  <div style={{ display: "flex", gap: 6, padding: "14px 24px 0", overflowX: "auto" }}>
                    {filters.map((f) => {
                      const count = getFilterCount(f.value);
                      const disabled = f.proOnly && !isPaid;
                      const active = filter === f.value;
                      return (
                        <button
                          key={f.value}
                          onClick={() => !disabled && setFilter(f.value)}
                          disabled={disabled}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 14px",
                            borderRadius: 20,
                            border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
                            background: active ? "var(--accent-bg)" : "var(--white)",
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: disabled
                              ? "var(--text3)"
                              : active
                                ? "var(--accent)"
                                : "var(--text2)",
                            cursor: disabled ? "default" : "pointer",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            transition: "all .12s",
                            fontFamily: "'Inter', sans-serif",
                            opacity: disabled ? 0.5 : 1,
                          }}
                        >
                          {f.icon} {f.label}
                          {searched && count > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "0 5px",
                                borderRadius: 8,
                                background: active ? "var(--accent)" : "var(--bg2)",
                                color: active ? "white" : "var(--text3)",
                              }}
                            >
                              {count}
                            </span>
                          )}
                          {disabled && (
                            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                              {lockIcon}
                              <span style={{ fontSize: 10, fontWeight: 600 }}>PRO</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Results */}
                <div style={{ padding: "16px 24px", flex: 1 }}>
                  {loading && results.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: "2px solid var(--border)",
                          borderTopColor: "var(--accent)",
                          borderRadius: "50%",
                          margin: "0 auto 8px",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <p style={{ fontSize: 12, color: "var(--text3)" }}>Searching…</p>
                    </div>
                  ) : searched && results.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>
                        No results found
                      </p>
                      <p style={{ fontSize: 12.5, color: "var(--text3)" }}>
                        Try different keywords or boolean operators (AND, OR, NOT, &quot;quoted phrases&quot;)
                      </p>
                    </div>
                  ) : !searched ? (
                    // Empty state with suggested searches
                    <div style={{ textAlign: "center", padding: "50px 0" }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--accent), #a34f18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 14px",
                        }}
                      >
                        <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                        Search regulations{isPaid ? ", guidance, and content" : ""}
                      </p>
                      <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto 20px" }}>
                        Use keywords, quoted phrases, or boolean operators (AND, OR, NOT)
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                        {["hours of service", "driver qualification", "drug testing", "\"hazardous materials\"", "electronic logging device"].map((q) => (
                          <button
                            key={q}
                            onClick={() => setQuery(q)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 16,
                              border: "1px solid var(--border)",
                              background: "var(--white)",
                              fontSize: 12,
                              color: "var(--text2)",
                              cursor: "pointer",
                              fontFamily: "'Inter', sans-serif",
                              transition: "border-color 0.12s",
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Result count */}
                      <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
                        {total} result{total !== 1 ? "s" : ""}
                        {loading && " (loading more…)"}
                      </p>

                      {/* Result cards */}
                      {results.map((r) => (
                        <ResultCard key={r.id} result={r} />
                      ))}

                      {/* Load more */}
                      {hasMore && (
                        <button
                          onClick={() => doSearch(query, filter, results.length, true)}
                          disabled={loading}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px",
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--white)",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text2)",
                            cursor: "pointer",
                            marginTop: 8,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {loading ? "Loading…" : "Load more results"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {isMobile && <MobileBottomTabs isPaid={isPaid} />}
    </div>
  );
}

// ── AiChat wrapper to expose submitQuestion via ref ──────────────────────────

import { forwardRef, useImperativeHandle } from "react";

const AiChatWrapper = forwardRef<{ submitQuestion: (q: string) => void }, { isPaid: boolean }>(
  function AiChatWrapper({ isPaid }, ref) {
    const chatRef = useRef<{ submitQuestion: (q: string) => void } | null>(null);

    useImperativeHandle(ref, () => ({
      submitQuestion: (q: string) => chatRef.current?.submitQuestion(q),
    }));

    return <AiChatWithRef ref={chatRef} isPaid={isPaid} />;
  }
);

const AiChatWithRef = forwardRef<{ submitQuestion: (q: string) => void }, { isPaid: boolean }>(
  function AiChatWithRef({ isPaid }, ref) {
    const submitRef = useRef<((q: string) => void) | null>(null);

    useImperativeHandle(ref, () => ({
      submitQuestion: (q: string) => submitRef.current?.(q),
    }));

    return <AiChatInner isPaid={isPaid} onSubmitRef={submitRef} />;
  }
);

function AiChatInner({
  isPaid,
  onSubmitRef,
}: {
  isPaid: boolean;
  onSubmitRef: React.MutableRefObject<((q: string) => void) | null>;
}) {
  return <AiChat isPaid={isPaid} onSubmitRef={onSubmitRef} />;
}

// ── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const { sourceType } = result;

  if (sourceType === "REGULATION") return <RegulationResultCard result={result} />;
  if (sourceType === "GUIDANCE") return <GuidanceResultCard result={result} />;
  return <ContentResultCard result={result} />;
}

function RegulationResultCard({ result }: { result: SearchResult }) {
  const href = result.section
    ? `/regs/${result.section}${result.paragraphId ? `#${result.paragraphId}` : ""}`
    : "#";

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", marginBottom: 10 }}>
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "14px 16px",
          cursor: "pointer",
          transition: "all .12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent-border)";
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(201,106,42,.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#1a6fc4",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {bookIcon} REGULATION
          </span>
          {result.part && (
            <span style={{ fontSize: 10, color: "var(--text3)" }}>Part {result.part}</span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6, lineHeight: 1.4 }}>
          {result.title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text2)",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
          dangerouslySetInnerHTML={{ __html: result.headline }}
        />
      </div>
    </Link>
  );
}

function GuidanceResultCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const readerHref = result.section ? `/regs/${result.section}?insights=open` : null;
  const fmcsaHref = result.url;

  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 10,
        transition: "all .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "#0d9488",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {infoIcon} FMCSA GUIDANCE
        </span>
        {result.section && (
          <span style={{ fontSize: 10, color: "var(--text3)" }}>
            § {result.section}
          </span>
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1.4,
          marginBottom: 6,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {result.title}
      </button>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text2)",
          lineHeight: 1.55,
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
        dangerouslySetInnerHTML={{ __html: result.headline }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 11.5,
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
        {fmcsaHref && (
          <a
            href={fmcsaHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11.5, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
          >
            View on FMCSA →
          </a>
        )}
        {readerHref && (
          <Link
            href={readerHref}
            style={{ fontSize: 11.5, color: "var(--text2)", textDecoration: "none", fontWeight: 500 }}
          >
            View § {result.section}
          </Link>
        )}
      </div>
    </div>
  );
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 800,
          background: "var(--bg)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text3)", padding: 4 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

function ContentResultCard({ result }: { result: SearchResult }) {
  const [showVideo, setShowVideo] = useState(false);
  const typeLabel = result.sourceType === "VIDEO" ? "VIDEO" : result.sourceType === "PODCAST" ? "PODCAST" : "ARTICLE";
  const typeColor = result.sourceType === "VIDEO" ? "#1a6fc4" : result.sourceType === "PODCAST" ? "#7c3aed" : "#059669";
  const isVideo = result.sourceType === "VIDEO" && result.url && extractYouTubeId(result.url);

  const cardContent = (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "all .12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-border)";
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(201,106,42,.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {result.thumbnailUrl && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img
            src={result.thumbnailUrl}
            alt=""
            style={{ width: 76, height: 56, objectFit: "cover", borderRadius: 6 }}
          />
          {isVideo && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,.3)",
                borderRadius: 6,
              }}
            >
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <polygon points="8 5 19 12 8 19 8 5" />
              </svg>
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: typeColor,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {result.sourceType === "ARTICLE" ? documentIcon : playIcon} {typeLabel}
          </span>
          {result.publisher && (
            <span style={{ fontSize: 10, color: "var(--text3)" }}>
              · {result.publisher}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 4 }}>
          {result.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text2)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          }}
          dangerouslySetInnerHTML={{ __html: result.headline }}
        />
      </div>
    </div>
  );

  if (isVideo) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div onClick={() => setShowVideo(true)} style={{ display: "block", cursor: "pointer" }}>
          {cardContent}
        </div>
        {showVideo && result.url && (
          <VideoModal url={result.url} title={result.title} onClose={() => setShowVideo(false)} />
        )}
      </div>
    );
  }

  return (
    <a
      href={result.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", marginBottom: 10 }}
    >
      {cardContent}
    </a>
  );
}
