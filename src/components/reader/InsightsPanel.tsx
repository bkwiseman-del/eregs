"use client";

import { useState, useEffect, useCallback } from "react";
import type { EcfrSection } from "@/lib/ecfr";

interface Insight {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  thumbnailUrl?: string | null;
  durationMinutes?: number | null;
  publisher?: string | null;
}

interface InsightsData {
  guidance: Insight[];
  videos: Insight[];
  articles: Insight[];
}

interface Props {
  section: EcfrSection;
  open: boolean;
  onClose: () => void;
  width?: number;
}

// ── Guidance Card ────────────────────────────────────────────────────────────

function GuidanceCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const body = insight.body ?? "";
  const truncated = body.length > 200 && !expanded;
  const displayBody = truncated ? body.slice(0, 200).replace(/\s+\S*$/, "") + "…" : body;

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
      marginBottom: 8, background: "var(--white)"
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6,
        fontSize: 10, fontWeight: 600, color: "var(--blue)",
        background: "var(--blue-bg)", border: "1px solid var(--blue-border)",
        borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em"
      }}>
        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        FMCSA Q&amp;A
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, lineHeight: 1.35 }}>
        {insight.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8, whiteSpace: "pre-line" }}>
        {displayBody}
        {body.length > 200 && (
          <span
            onClick={() => setExpanded(!expanded)}
            style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500, marginLeft: 4 }}
          >
            {expanded ? "Show less" : "Read more"}
          </span>
        )}
      </div>
      {insight.url && (
        <a
          href={insight.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text3)", textDecoration: "none" }}
        >
          <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
          {insight.publisher ?? "FMCSA"} · fmcsa.dot.gov
        </a>
      )}
    </div>
  );
}

// ── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ insight, onPlay }: { insight: Insight; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      style={{ display: "flex", gap: 10, marginBottom: 10, cursor: "pointer" }}
    >
      <div style={{
        width: 72, height: 48, borderRadius: 6, flexShrink: 0,
        backgroundImage: insight.thumbnailUrl ? `url(${insight.thumbnailUrl})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        background: insight.thumbnailUrl
          ? `url(${insight.thumbnailUrl}) center/cover`
          : "linear-gradient(135deg, #1a2a3a, var(--accent))",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="10" height="10" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", lineHeight: 1.35, marginBottom: 3 }}>
          {insight.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {insight.publisher ?? "Trucksafe"}
          {insight.durationMinutes ? ` · ${insight.durationMinutes} min` : ""}
        </div>
      </div>
    </div>
  );
}

// ── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  const videoId = insight.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720, background: "var(--white)",
          borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {insight.title}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              padding: 4, color: "var(--text3)", flexShrink: 0, marginLeft: 8,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* Player */}
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={insight.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ insight }: { insight: Insight }) {
  const body = insight.body ?? "";
  const truncatedBody = body.length > 150
    ? body.slice(0, 150).replace(/\s+\S*$/, "") + "…"
    : body;

  return (
    <a
      href={insight.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
        marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s",
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35, marginBottom: truncatedBody ? 5 : 6 }}>
          {insight.title}
        </div>
        {truncatedBody && (
          <div style={{ fontSize: 11.5, color: "var(--text2)", lineHeight: 1.45, marginBottom: 6 }}>
            {truncatedBody}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text3)" }}>
          <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
          {insight.publisher ?? "Trucksafe"}
        </div>
      </div>
    </a>
  );
}

// ── Loading Spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
      <div style={{
        width: 20, height: 20, border: "2px solid var(--border)",
        borderTopColor: "var(--accent)", borderRadius: "50%",
        animation: "ip-spin 0.6s linear infinite",
      }} />
      <style>{`@keyframes ip-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function InsightsPanel({ section, open, onClose, width = 296 }: Props) {
  const [activeTab, setActiveTab] = useState<"guidance" | "videos" | "articles">("guidance");
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<Insight | null>(null);

  const fetchInsights = useCallback(async (sectionId: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/insights?section=${encodeURIComponent(sectionId)}`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      const json: InsightsData = await res.json();
      setData(json);

      // Auto-select first tab that has content
      if (json.guidance.length > 0) setActiveTab("guidance");
      else if (json.videos.length > 0) setActiveTab("videos");
      else if (json.articles.length > 0) setActiveTab("articles");
      else setActiveTab("guidance");
    } catch {
      setData({ guidance: [], videos: [], articles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && section?.section) {
      fetchInsights(section.section);
    }
  }, [open, section?.section, fetchInsights]);

  if (!open) return null;

  const counts = data
    ? { guidance: data.guidance.length, videos: data.videos.length, articles: data.articles.length }
    : { guidance: 0, videos: 0, articles: 0 };

  const totalCount = counts.guidance + counts.videos + counts.articles;

  return (
    <>
      <aside style={{
        width, flexShrink: 0, background: "var(--white)",
        borderLeft: "none", display: "flex",
        flexDirection: "column", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
            § {section.section} Insights
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {(["guidance", "videos", "articles"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 10px", border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 12.5, fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "var(--accent)" : "var(--text3)",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {data && counts[tab] > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: activeTab === tab ? "var(--accent)" : "var(--text3)",
                    background: activeTab === tab ? "var(--accent-bg)" : "var(--bg2)",
                    padding: "1px 5px", borderRadius: 8, lineHeight: "14px",
                  }}>
                    {counts[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px" }}>
          {loading && <Spinner />}

          {!loading && data && totalCount === 0 && (
            <div style={{ textAlign: "center", padding: "32px 12px", color: "var(--text3)", fontSize: 12.5 }}>
              No insights available for this section.
            </div>
          )}

          {!loading && data && activeTab === "guidance" && (
            counts.guidance > 0
              ? data.guidance.map((g) => <GuidanceCard key={g.id} insight={g} />)
              : totalCount > 0 && (
                <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text3)", fontSize: 12 }}>
                  No guidance for this section.
                </div>
              )
          )}

          {!loading && data && activeTab === "videos" && (
            counts.videos > 0
              ? <div style={{ paddingTop: 4 }}>
                  {data.videos.map((v) => (
                    <VideoCard key={v.id} insight={v} onPlay={() => setPlayingVideo(v)} />
                  ))}
                </div>
              : totalCount > 0 && (
                <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text3)", fontSize: 12 }}>
                  No videos for this section.
                </div>
              )
          )}

          {!loading && data && activeTab === "articles" && (
            counts.articles > 0
              ? data.articles.map((a) => <ArticleCard key={a.id} insight={a} />)
              : totalCount > 0 && (
                <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text3)", fontSize: 12 }}>
                  No articles for this section.
                </div>
              )
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 10.5, color: "var(--text3)", lineHeight: 1.4 }}>
            Insights are for informational purposes only and do not constitute legal advice.
          </div>
        </div>
      </aside>

      {/* Video player modal */}
      {playingVideo && (
        <VideoModal insight={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </>
  );
}
