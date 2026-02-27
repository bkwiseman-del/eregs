"use client";

import { useState, useEffect, useMemo } from "react";
import type { EcfrSection, EcfrNode } from "@/lib/ecfr";
import type { ReaderAnnotation } from "@/lib/annotations";
import { makeParagraphId } from "@/lib/annotations";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { DiffView } from "./DiffView";
import { ImpactReviewPanel } from "./ImpactReviewPanel";
import { diffSections } from "@/lib/diff";

interface Props {
  section: EcfrSection;
  currentSectionContent?: EcfrNode[];
  adjacent: { prev: string | null; next: string | null };
  onNavigate?: (section: string) => void;
  annotations: ReaderAnnotation[];
  impactedAnnotations?: ReaderAnnotation[];
  selectedPids: Set<string>;
  onTogglePara: (pid: string) => void;
  onEditNote: (annotation: ReaderAnnotation) => void;
  historicalDate?: string | null;
  historicalLoading?: boolean;
  onSelectHistoricalDate?: (date: string | null) => void;
  diffMode?: boolean;
  onToggleDiff?: () => void;
  isPro?: boolean;
  impactedAnnotationCount?: number;
  onDismissImpact?: () => void;
  onKeepAnnotation?: (id: string) => void;
  onDeleteAnnotation?: (id: string, type: string) => void;
}

function NoteBubble({ annotation, onEdit }: { annotation: ReaderAnnotation; onEdit: () => void }) {
  const impacted = annotation.impactedByChange;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onEdit(); }}
      style={{
        margin: "4px -10px 6px",
        background: impacted ? "#fef3c7" : "var(--note-bg)",
        border: impacted ? "1px solid #f59e0b" : "1px solid var(--note-border)",
        borderLeft: impacted ? "3px solid #f59e0b" : "3px solid var(--blue)",
        borderRadius: 7,
        padding: "10px 13px",
        fontSize: 13, color: impacted ? "#92400e" : "var(--blue)", lineHeight: 1.55,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {impacted && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Regulation text may have changed
        </div>
      )}
      <div>"{annotation.note}"</div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
        {new Date(annotation.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

function RenderNode({
  node,
  index,
  section,
  annotations,
  selectedPids,
  onTogglePara,
  onEditNote,
}: {
  node: EcfrNode;
  index: number;
  section: string;
  annotations: ReaderAnnotation[];
  selectedPids: Set<string>;
  onTogglePara: (pid: string) => void;
  onEditNote: (annotation: ReaderAnnotation) => void;
}) {
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];

  // HEADING (appendix section headings)
  if (node.type === "heading") {
    const sizes: Record<number, { fontSize: number; marginTop: number }> = {
      1: { fontSize: 17, marginTop: 32 },
      2: { fontSize: 15, marginTop: 24 },
      3: { fontSize: 14, marginTop: 18 },
    };
    const { fontSize, marginTop } = sizes[node.headingLevel ?? 1] ?? sizes[1];
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize, fontWeight: 600, color: "var(--text)",
        marginTop, marginBottom: 8,
        paddingBottom: node.headingLevel === 1 ? 6 : 0,
        borderBottom: node.headingLevel === 1 ? "1px solid var(--border)" : "none",
      }}>
        {node.text}
      </div>
    );
  }

  // TABLE
  if (node.type === "table") {
    return (
      <div style={{ overflowX: "auto", margin: "20px 0" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          fontSize: 13.5, fontFamily: "'Inter', sans-serif",
        }}>
          {node.tableHeaders && node.tableHeaders.length > 0 && (
            <thead>
              <tr>
                {node.tableHeaders.map((h, i) => (
                  <th key={i} style={{
                    padding: "8px 12px", textAlign: "left",
                    background: "var(--bg2)", borderBottom: "2px solid var(--border2)",
                    color: "var(--text)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {node.tableRows?.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid var(--border)" }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: "7px 12px", color: "var(--text)",
                    verticalAlign: "top", lineHeight: 1.5,
                    background: ri % 2 === 0 ? "var(--white)" : "var(--bg)",
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // IMAGE
  if (node.type === "image") {
    const imagePath = node.imageSrc?.startsWith("http")
      ? new URL(node.imageSrc).pathname
      : node.imageSrc;
    const src = `/api/ecfr-image?path=${encodeURIComponent(imagePath || "")}`;
    return (
      <div style={{ margin: "20px 0", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={node.imageCaption || "Regulatory diagram"}
          style={{ maxWidth: "100%", height: "auto", border: "1px solid var(--border)", borderRadius: 4 }}
          loading="lazy"
        />
        {node.imageCaption && (
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6, fontStyle: "italic" }}>
            {node.imageCaption}
          </div>
        )}
      </div>
    );
  }

  // PARAGRAPH — tappable, highlightable, notable
  const pid = makeParagraphId(section, node.label, index);
  const isSelected = selectedPids.has(pid);
  const highlight = annotations.find(a => a.type === "HIGHLIGHT" && (a.paragraphIds?.includes(pid) || a.paragraphId === pid));
  const noteAnnotation = annotations.find(
    a => a.type === "NOTE" && (a.paragraphIds?.includes(pid) || a.paragraphId === pid)
  );
  const isHighlighted = !!highlight;
  const highlightImpacted = highlight?.impactedByChange;
  const hasNote = !!noteAnnotation;
  // Note bubble renders only after the last paragraph in the selection
  const isLastNoteParagraph = noteAnnotation && noteAnnotation.paragraphId === pid;

  return (
    <div id={pid}>
      <div
        onClick={() => onTogglePara(pid)}
        style={{
          display: "flex", gap: 0,
          padding: "10px 10px",
          margin: isHighlighted ? "0 -10px 2px -13px" : "0 -10px 2px",
          paddingLeft: isHighlighted ? `${indent + 10}px` : `${indent + 10}px`,
          borderRadius: 8,
          border: isSelected
            ? "1.5px solid var(--sel-border)"
            : isHighlighted
              ? "1.5px solid var(--yellow-hl-border)"
              : "1.5px solid transparent",
          borderLeft: isHighlighted ? "3px solid #c8a800" : isSelected ? "1.5px solid var(--sel-border)" : "1.5px solid transparent",
          background: isSelected
            ? (isHighlighted ? "rgba(253, 224, 71, 0.25)" : "var(--sel-color)")
            : isHighlighted
              ? "var(--yellow-hl)"
              : "transparent",
          position: "relative",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: "pointer",
          transition: "background 0.1s, border-color 0.1s",
        }}
      >
        {/* Paragraph label */}
        {node.label && (
          <span style={{
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 13.5,
            fontStyle: "italic",
            color: isHighlighted ? "#8a6a00" : isSelected ? "var(--accent)" : "var(--text3)",
            minWidth: 32, flexShrink: 0, paddingTop: 3, paddingRight: 8,
            userSelect: "none",
            transition: "color 0.12s",
            whiteSpace: "nowrap",
          }}>
            ({node.label})
          </span>
        )}

        {/* Paragraph text */}
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 15.5, lineHeight: 1.82,
          color: isHighlighted ? "#3a2c00" : "var(--text)",
          flex: 1, minWidth: 0,
        }}>
          {node.text}
        </span>

        {/* Impact warning icon on highlighted paragraphs */}
        {highlightImpacted && !hasNote && (
          <span title="Regulation text may have changed since this highlight was created" style={{
            position: "absolute", right: 9, top: 9,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        )}

        {/* Note indicator dot */}
        {hasNote && (
          <span style={{
            position: "absolute", right: 9, top: 11,
            width: 7, height: 7, borderRadius: "50%",
            background: noteAnnotation?.impactedByChange ? "#f59e0b" : "var(--blue)",
            boxShadow: "0 0 0 2px white",
          }} />
        )}
      </div>

      {/* Note bubble — only after the last paragraph in the selection */}
      {isLastNoteParagraph && noteAnnotation.note && (
        <NoteBubble annotation={noteAnnotation} onEdit={() => onEditNote(noteAnnotation)} />
      )}
    </div>
  );
}

export function ReaderContent({
  section, currentSectionContent, adjacent, onNavigate, annotations,
  impactedAnnotations,
  selectedPids, onTogglePara, onEditNote,
  historicalDate, historicalLoading, onSelectHistoricalDate,
  diffMode, onToggleDiff,
  isPro,
  impactedAnnotationCount, onDismissImpact,
  onKeepAnnotation, onDeleteAnnotation,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  // Close panels on section change
  useEffect(() => { setHistoryOpen(false); setReviewMode(false); }, [section.section]);

  // Close review mode when all impacted annotations are resolved
  useEffect(() => {
    if (reviewMode && (!impactedAnnotations || impactedAnnotations.length === 0)) {
      setReviewMode(false);
    }
  }, [reviewMode, impactedAnnotations]);

  // Compute diff results when in diff mode
  const diffResults = useMemo(() => {
    if (!diffMode || !historicalDate || !currentSectionContent) return null;
    return diffSections(section.content, currentSectionContent);
  }, [diffMode, historicalDate, section.content, currentSectionContent]);

  const navClick = (sectionId: string) => (e: React.MouseEvent) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(sectionId);
    }
  };

  return (
    <div
      style={{ maxWidth: 740, margin: "0 auto", padding: "0 24px 120px" }}
      onClick={(e) => {
        // Click on empty space clears selection
        const target = e.target as HTMLElement;
        if (!target.closest("[data-para]") && !target.closest("[data-note-bubble]")) {
          // Don't clear here — let ReaderShell handle it
        }
      }}
    >
      {/* Pulsing dot animation */}
      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
        }
        @keyframes pulse-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0); }
        }
      `}</style>

      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 32,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          {historicalDate ? (
            <>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#f59e0b",
                display: "inline-block", flexShrink: 0,
                animation: "pulse-amber 2s ease-in-out infinite",
              }} />
              <span>
                {historicalLoading ? "Loading historical version…" : (
                  <>
                    Viewing as of{" "}
                    <span style={{ fontWeight: 600, color: "#92400e" }}>
                      {new Date(historicalDate + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </>
                )}
              </span>
              <span style={{ color: "var(--border2)", margin: "0 2px" }}>·</span>
              <button
                onClick={() => onSelectHistoricalDate?.(null)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "var(--accent)", fontWeight: 600,
                  padding: 0, fontFamily: "'Inter', sans-serif",
                }}
              >
                View current
              </button>
              {onToggleDiff && !historicalLoading && (
                <>
                  <span style={{ color: "var(--border2)", margin: "0 2px" }}>·</span>
                  <button
                    onClick={onToggleDiff}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 12, color: diffMode ? "#dc2626" : "var(--accent)", fontWeight: 600,
                      padding: 0, fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {diffMode ? "Hide changes" : "Show changes"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "var(--green)",
                display: "inline-block", flexShrink: 0,
                animation: "pulse-green 2s ease-in-out infinite",
              }} />
              Viewing current regulations
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* History button (Pro only) */}
          {onSelectHistoricalDate ? (
            <button
              onClick={() => setHistoryOpen(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, color: historyOpen ? "var(--accent)" : "var(--text3)",
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 6px", borderRadius: 5,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History
            </button>
          ) : (
            <span
              title="Version history is a Pro feature"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "var(--text3)", opacity: 0.5,
                cursor: "default",
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </span>
          )}

          <a
            href={`https://www.ecfr.gov/current/title-49/section-${section.section}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text3)", textDecoration: "none" }}
          >
            eCFR
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Version History Panel */}
      {historyOpen && onSelectHistoricalDate && (
        <VersionHistoryPanel
          section={section.section}
          historicalDate={historicalDate}
          onSelectDate={(date) => {
            onSelectHistoricalDate(date);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Annotation Impact Warning Banner */}
      {!historicalDate && impactedAnnotationCount && impactedAnnotationCount > 0 ? (
        <>
          <div style={{
            background: "#fef3c7", border: "1px solid #fde68a",
            borderRadius: 8, padding: "10px 14px", marginBottom: reviewMode ? 0 : 20,
            borderBottomLeftRadius: reviewMode ? 0 : 8,
            borderBottomRightRadius: reviewMode ? 0 : 8,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ flex: 1, fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
              Regulations in this section have changed since you made {impactedAnnotationCount === 1 ? "an annotation" : `${impactedAnnotationCount} annotations`}. Some highlights or notes may reference changed text.
            </span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {onKeepAnnotation && impactedAnnotations && impactedAnnotations.length > 0 && (
                <button
                  onClick={() => setReviewMode(v => !v)}
                  style={{
                    padding: "4px 10px", borderRadius: 5,
                    background: reviewMode ? "#92400e" : "rgba(146, 64, 14, 0.15)",
                    border: "1px solid rgba(146, 64, 14, 0.3)",
                    fontSize: 11, fontWeight: 600,
                    color: reviewMode ? "#fff" : "#92400e",
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {reviewMode ? "Close" : `Review (${impactedAnnotationCount})`}
                </button>
              )}
              {onDismissImpact && (
                <button
                  onClick={onDismissImpact}
                  style={{
                    padding: "4px 10px", borderRadius: 5,
                    background: "rgba(146, 64, 14, 0.1)", border: "1px solid rgba(146, 64, 14, 0.2)",
                    fontSize: 11, fontWeight: 600, color: "#92400e", cursor: "pointer",
                    whiteSpace: "nowrap", flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Dismiss all
                </button>
              )}
            </div>
          </div>
          {reviewMode && impactedAnnotations && impactedAnnotations.length > 0 && onKeepAnnotation && onDeleteAnnotation && (
            <ImpactReviewPanel
              annotations={impactedAnnotations}
              sectionContent={section.content}
              sectionId={section.section}
              onKeep={onKeepAnnotation}
              onDelete={onDeleteAnnotation}
              onClose={() => setReviewMode(false)}
            />
          )}
          {reviewMode && <div style={{ marginBottom: 20 }} />}
        </>
      ) : null}

      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        {section.subpartLabel && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--text3)",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
          }}>
            Subpart {section.subpartLabel} — {section.subpartTitle}
          </div>
        )}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11.5, fontWeight: 500,
          color: "var(--accent)", background: "var(--accent-bg)",
          border: "1px solid var(--accent-border)",
          display: "inline-block", padding: "3px 9px", borderRadius: 5, marginBottom: 9,
        }}>
          § {section.section.includes("-app")
            ? section.section.replace(/^\d+-app/, "Appendix ").replace(/-sub/, " to Subpart ")
            : section.section}
        </div>
        <h1 style={{
          fontSize: 25, fontWeight: 400, color: "var(--text)",
          fontFamily: "'Lora', Georgia, serif", lineHeight: 1.22,
          letterSpacing: -0.3,
        }}>
          {section.title}
        </h1>
        <div style={{
          marginTop: 18, height: 1,
          background: "linear-gradient(to right, var(--border), transparent 70%)",
        }} />
      </div>

      {/* Regulation content — tappable paragraphs or diff view */}
      <div style={{ marginBottom: 48 }}>
        {diffMode && diffResults && historicalDate ? (
          <DiffView results={diffResults} historicalDate={historicalDate} />
        ) : (
          section.content.map((node, i) => (
            <RenderNode
              key={node.id}
              node={node}
              index={i}
              section={section.section}
              annotations={annotations}
              selectedPids={selectedPids}
              onTogglePara={onTogglePara}
              onEditNote={onEditNote}
            />
          ))
        )}
      </div>

      {/* Prev / Next */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        {adjacent.prev ? (
          <a href={`/regs/${adjacent.prev}`} onClick={navClick(adjacent.prev)} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              border: "1px solid var(--border)", borderRadius: 8, background: "var(--white)",
              cursor: "pointer", color: "var(--text2)", fontSize: 13,
            }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              <div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 1 }}>Previous</div>
                <div style={{ fontWeight: 500 }}>§ {adjacent.prev}</div>
              </div>
            </div>
          </a>
        ) : <div />}

        {adjacent.next && (
          <a href={`/regs/${adjacent.next}`} onClick={navClick(adjacent.next)} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              border: "1px solid var(--border)", borderRadius: 8, background: "var(--white)",
              cursor: "pointer", color: "var(--text2)", fontSize: 13,
            }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 1 }}>Next</div>
                <div style={{ fontWeight: 500 }}>§ {adjacent.next}</div>
              </div>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}
