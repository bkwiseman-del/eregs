"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { ReaderAnnotation } from "@/lib/annotations";

type AnnotationType = "NOTE" | "HIGHLIGHT" | "BOOKMARK";

interface Props {
  type: AnnotationType;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}

/** Group annotations by "Part {part} — § {section}" */
interface SectionGroup {
  key: string;       // e.g. "390-390.5"
  part: string;
  section: string;
  annotations: ReaderAnnotation[];
}

function groupBySection(annotations: ReaderAnnotation[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>();
  for (const a of annotations) {
    const key = `${a.part}-${a.section}`;
    let group = map.get(key);
    if (!group) {
      group = { key, part: a.part, section: a.section, annotations: [] };
      map.set(key, group);
    }
    group.annotations.push(a);
  }
  return Array.from(map.values());
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sectionDisplayName(section: string): string {
  if (section.includes("-app")) {
    return section.replace(/^\d+-app/, "Appendix ").replace(/-sub/, " Sub ");
  }
  return `§ ${section}`;
}

/** Extract short paragraph labels from paragraph IDs */
function paragraphLabel(paragraphId: string, paragraphIds?: string[]): string {
  // For notes with multiple paragraphs, show range
  if (paragraphIds && paragraphIds.length > 1) {
    const labels = paragraphIds.map(pid => {
      const parts = pid.split("-");
      if (parts.length >= 3) {
        const l = parts[parts.length - 1];
        if (l.startsWith("p")) return null;
        return `(${l})`;
      }
      return null;
    }).filter(Boolean);
    if (labels.length > 0) return labels.join(", ");
    return `${paragraphIds.length} paragraphs`;
  }
  // Single paragraph
  const parts = paragraphId.split("-");
  if (parts.length >= 3) {
    const label = parts[parts.length - 1];
    if (label.startsWith("p")) return "";
    return `(${label})`;
  }
  return "";
}

export function AnnotationListView({ type, emptyIcon, emptyTitle, emptyDescription }: Props) {
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/annotations/all?type=${type}`)
      .then(res => {
        if (res.status === 401) {
          // Not authenticated — this shouldn't happen since the page checks,
          // but handle gracefully
          setError("unauthorized");
          return [];
        }
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(data => {
        if (!cancelled) setAnnotations(data || []);
      })
      .catch(() => {
        if (!cancelled) setError("failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [type]);

  const groups = useMemo(() => groupBySection(annotations), [annotations]);

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{
          width: 24, height: 24, border: "2.5px solid var(--border)",
          borderTopColor: "var(--accent)", borderRadius: "50%",
          margin: "0 auto 12px",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: 13, color: "var(--text3)" }}>Loading…</p>
      </div>
    );
  }

  // Error state
  if (error === "failed") {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 8 }}>
          Something went wrong loading your {type.toLowerCase()}s.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 16px", borderRadius: 8,
            background: "var(--bg2)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--text2)", cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (annotations.length === 0) {
    return (
      <div style={{
        padding: "60px 20px", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "var(--bg2)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text3)", marginBottom: 16,
        }}>
          {emptyIcon}
        </div>
        <p style={{
          fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 500,
          color: "var(--text)", marginBottom: 6,
        }}>
          {emptyTitle}
        </p>
        <p style={{ fontSize: 13, color: "var(--text3)", maxWidth: 300, lineHeight: 1.5 }}>
          {emptyDescription}
        </p>
        <Link
          href="/regs/390.1"
          style={{
            marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 20px", borderRadius: 8,
            background: "var(--accent)", color: "white",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Open Regulations
        </Link>
      </div>
    );
  }

  // Annotations list grouped by section
  return (
    <div style={{
      maxWidth: 680, margin: "0 auto",
      padding: "20px 16px 80px",
    }}>
      {/* Summary */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 20, paddingBottom: 14,
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "var(--accent)",
          background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
          padding: "2px 10px", borderRadius: 10,
        }}>
          {annotations.length}
        </span>
        <span style={{ fontSize: 13, color: "var(--text2)" }}>
          {type.toLowerCase()}{annotations.length !== 1 ? "s" : ""} across {groups.length} section{groups.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Section groups */}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 24 }}>
          {/* Section header */}
          <Link
            href={`/regs/${group.section}`}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              textDecoration: "none", marginBottom: 8,
              padding: "6px 0",
            }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: "var(--accent)", background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              padding: "2px 7px", borderRadius: 4, flexShrink: 0,
            }}>
              {sectionDisplayName(group.section)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>
              Part {group.part}
            </span>
            <svg
              width="12" height="12" fill="none" stroke="var(--text3)"
              strokeWidth="2" viewBox="0 0 24 24"
              style={{ marginLeft: "auto", flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

          {/* Annotation cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.annotations.map(anno => (
              <AnnotationCard key={anno.id} annotation={anno} type={type} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnnotationCard({ annotation: a, type }: { annotation: ReaderAnnotation; type: AnnotationType }) {
  const label = paragraphLabel(a.paragraphId, a.paragraphIds);

  const firstPid = a.paragraphIds?.[0] ?? a.paragraphId;
  const href = `/regs/${a.section}${firstPid ? `#${firstPid}` : ""}`;

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 14px",
        cursor: "pointer", transition: "all 0.15s",
        display: "flex", gap: 12, alignItems: "flex-start",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Type indicator */}
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 7,
          background: type === "NOTE" ? "var(--blue)"
            : type === "HIGHLIGHT" ? "#c8a800"
            : "var(--accent)",
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Paragraph reference */}
          {label && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: "var(--text3)", marginBottom: 3, display: "block",
            }}>
              {label}
            </span>
          )}

          {/* Note: regulation text context + user's note */}
          {type === "NOTE" && (
            <>
              {a.textSnippet && (
                <p style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5,
                  marginBottom: 6,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                  fontStyle: "italic",
                }}>
                  {a.textSnippet}
                </p>
              )}
              {a.note && (
                <p style={{
                  fontSize: 13.5, color: "var(--text)", lineHeight: 1.55,
                  marginBottom: 4,
                  display: "-webkit-box", WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {a.note}
                </p>
              )}
            </>
          )}

          {/* For highlights, show text snippet or paragraph reference */}
          {type === "HIGHLIGHT" && (
            a.textSnippet ? (
              <p style={{
                fontFamily: "'Lora', Georgia, serif",
                fontSize: 13.5, color: "var(--text)", lineHeight: 1.6,
                marginBottom: 4,
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {a.textSnippet}
              </p>
            ) : (
              <p style={{
                fontSize: 13, color: "var(--text2)", lineHeight: 1.5,
                fontStyle: "italic",
              }}>
                Highlighted {(a.paragraphIds?.length ?? 1) > 1
                  ? `${a.paragraphIds!.length} paragraphs`
                  : `paragraph${label ? ` ${label}` : ""}`}
              </p>
            )
          )}

          {/* For bookmarks, show section title + text preview */}
          {type === "BOOKMARK" && (
            <>
              {a.sectionTitle && (
                <p style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: 14, color: "var(--text)", lineHeight: 1.4,
                  fontWeight: 500, marginBottom: 4,
                }}>
                  {a.sectionTitle}
                </p>
              )}
              {a.textSnippet ? (
                <p style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5,
                  marginBottom: 4,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {a.textSnippet}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                  Saved section
                </p>
              )}
            </>
          )}

          {/* Timestamp */}
          <span style={{ fontSize: 11, color: "var(--text3)" }}>
            {formatTimeAgo(a.updatedAt ?? a.createdAt)}
          </span>
        </div>

        {/* Arrow */}
        <svg
          width="14" height="14" fill="none" stroke="var(--text3)"
          strokeWidth="2" viewBox="0 0 24 24"
          style={{ flexShrink: 0, marginTop: 4, opacity: 0.5 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}
