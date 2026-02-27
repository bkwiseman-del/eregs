"use client";

import { useState, useEffect, useRef } from "react";

interface TimelineEntry {
  date: string;
  amendmentDate: string;
  substantive: boolean;
  removed: boolean;
  name: string;
  changelog: {
    changeType: string;
    summary: string | null;
    federalRegCitation: string | null;
  } | null;
}

interface Props {
  section: string;
  historicalDate: string | null | undefined;
  onSelectDate: (date: string | null) => void;
  onClose: () => void;
}

export function VersionHistoryPanel({ section, historicalDate, onSelectDate, onClose }: Props) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/section-history?section=${section}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then(data => {
        if (!cancelled) setTimeline(data.timeline ?? []);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [section]);

  // Close on click outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px",
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        maxHeight: 400,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Version History
          </span>
          <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 8 }}>
            § {section}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text3)", padding: 4,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Explainer */}
      {!loading && timeline.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 12px" }}>
          View this section as it existed on the dates below. Historical versions go back to{" "}
          {new Date(timeline[timeline.length - 1].date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}{" "}
          in eCFR. Red dots indicate substantive changes to the regulation text.
        </p>
      )}

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 20, height: 20, border: "2px solid var(--border)",
              borderTopColor: "var(--accent)", borderRadius: "50%",
              margin: "0 auto 8px",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: 12, color: "var(--text3)" }}>Loading history…</p>
          </div>
        ) : timeline.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: "16px 0" }}>
            No version history available for this section.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {timeline.map((entry, i) => {
              const isActive = historicalDate === entry.date;
              const formatted = new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <button
                  key={`${entry.date}-${i}`}
                  onClick={() => onSelectDate(entry.date)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "8px 10px",
                    borderRadius: 7,
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    border: isActive ? "1px solid var(--accent-border)" : "1px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "'Inter', sans-serif",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Timeline dot + connector line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: entry.substantive ? "#ef4444" : "var(--text3)",
                      border: isActive ? "2px solid var(--accent)" : "none",
                      boxSizing: "content-box",
                      marginTop: 4,
                    }} />
                    {i < timeline.length - 1 && (
                      <div style={{
                        width: 1, flex: 1, minHeight: 12,
                        background: "var(--border)",
                        marginTop: 4,
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text)" }}>
                        {formatted}
                      </span>
                      {entry.substantive ? (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px",
                          borderRadius: 4, background: "#fef2f2", color: "#dc2626",
                          border: "1px solid #fecaca",
                        }}>
                          Substantive
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10, fontWeight: 500, padding: "1px 6px",
                          borderRadius: 4, background: "var(--bg2)", color: "var(--text3)",
                          border: "1px solid var(--border)",
                        }}>
                          Editorial
                        </span>
                      )}
                    </div>
                    {entry.changelog?.summary && (
                      <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.4, margin: 0 }}>
                        {entry.changelog.summary}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
