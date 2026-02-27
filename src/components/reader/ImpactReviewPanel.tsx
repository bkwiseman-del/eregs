"use client";

import { useState } from "react";
import type { EcfrNode } from "@/lib/ecfr";
import type { ReaderAnnotation } from "@/lib/annotations";
import { makeParagraphId } from "@/lib/annotations";

interface Props {
  annotations: ReaderAnnotation[];
  sectionContent: EcfrNode[];
  sectionId: string;
  onKeep: (id: string) => void;
  onDelete: (id: string, type: string) => void;
  onClose: () => void;
}

export function ImpactReviewPanel({
  annotations, sectionContent, sectionId,
  onKeep, onDelete, onClose,
}: Props) {
  const [index, setIndex] = useState(0);

  if (annotations.length === 0) return null;

  // Clamp index if annotations shrink (after keep/delete)
  const current = annotations[Math.min(index, annotations.length - 1)];
  const safeIndex = Math.min(index, annotations.length - 1);

  // Find the paragraph text for this annotation
  const paragraphText = getParagraphText(current, sectionContent, sectionId);
  const typeLabel = current.type === "HIGHLIGHT" ? "Highlight" : current.type === "NOTE" ? "Note" : "Bookmark";

  const handleKeep = () => {
    onKeep(current.id);
    // If this was the last one, panel will auto-close via parent effect
    if (annotations.length <= 1) return;
    // Stay at same index (next item shifts in), but clamp if at end
    if (safeIndex >= annotations.length - 1) {
      setIndex(Math.max(0, safeIndex - 1));
    }
  };

  const handleDelete = () => {
    onDelete(current.id, current.type);
    if (annotations.length <= 1) return;
    if (safeIndex >= annotations.length - 1) {
      setIndex(Math.max(0, safeIndex - 1));
    }
  };

  return (
    <div style={{
      background: "#fffbeb",
      border: "1px solid #fde68a",
      borderTop: "none",
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      padding: "12px 14px",
      marginBottom: 0,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
          Review annotations
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#92400e" }}>
            {safeIndex + 1} of {annotations.length}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#92400e", padding: 2, lineHeight: 0,
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Annotation info */}
      <div style={{
        background: "rgba(255,255,255,0.7)", border: "1px solid #fde68a",
        borderRadius: 6, padding: "10px 12px", marginBottom: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.05em", color: "#92400e",
            padding: "1px 5px", borderRadius: 3,
            background: "rgba(146, 64, 14, 0.1)",
          }}>
            {typeLabel}
          </span>
          {current.paragraphId && (
            <span style={{ fontSize: 11, color: "#78716c" }}>
              on {formatParagraphRef(current)}
            </span>
          )}
        </div>

        {/* Show the paragraph text this annotation references */}
        {paragraphText && (
          <div style={{
            fontSize: 13, color: "var(--text)",
            fontFamily: "'Lora', Georgia, serif",
            lineHeight: 1.6, fontStyle: "italic",
            borderLeft: "2px solid #fde68a",
            paddingLeft: 10,
            maxHeight: 80, overflow: "hidden",
          }}>
            "{paragraphText}"
          </div>
        )}

        {/* For notes, also show the note text */}
        {current.type === "NOTE" && current.note && (
          <div style={{
            marginTop: 8, padding: "6px 10px",
            background: "var(--note-bg)", border: "1px solid var(--note-border)",
            borderRadius: 5, fontSize: 12, color: "var(--blue)",
            lineHeight: 1.5,
          }}>
            {current.note}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={handleKeep} style={actionBtn("#166534", "#dcfce7", "#86efac")}>
          Keep
        </button>
        <button onClick={handleDelete} style={actionBtn("#dc2626", "#fef2f2", "#fecaca")}>
          Delete
        </button>
        <div style={{ flex: 1 }} />
        {annotations.length > 1 && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
              style={{
                ...navBtn(),
                opacity: safeIndex === 0 ? 0.3 : 1,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => setIndex(i => Math.min(annotations.length - 1, i + 1))}
              disabled={safeIndex >= annotations.length - 1}
              style={{
                ...navBtn(),
                opacity: safeIndex >= annotations.length - 1 ? 0.3 : 1,
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function actionBtn(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: "5px 14px", borderRadius: 5,
    background: bg, border: `1px solid ${border}`,
    fontSize: 12, fontWeight: 600, color,
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  };
}

function navBtn(): React.CSSProperties {
  return {
    background: "none", border: "1px solid #fde68a",
    borderRadius: 4, padding: 3, cursor: "pointer",
    color: "#92400e", lineHeight: 0,
  };
}

function getParagraphText(
  annotation: ReaderAnnotation,
  content: EcfrNode[],
  sectionId: string,
): string {
  // Try to find the paragraph by matching paragraph ID
  const pid = annotation.paragraphId;
  if (!pid) return "";
  for (let i = 0; i < content.length; i++) {
    const node = content[i];
    const nodePid = makeParagraphId(sectionId, node.label, i);
    if (nodePid === pid) {
      const text = node.text;
      return text.length > 150 ? text.slice(0, 150) + "…" : text;
    }
  }
  // Fallback: try textSnippet from annotation
  return annotation.textSnippet || "";
}

function formatParagraphRef(annotation: ReaderAnnotation): string {
  const pids = annotation.paragraphIds;
  if (!pids || pids.length === 0) {
    return annotation.paragraphId || "";
  }
  // Extract labels from paragraph IDs (format: section-index-label)
  const labels = pids.map(pid => {
    const parts = pid.split("-");
    const label = parts[parts.length - 1];
    // If the label is just a number, it's an index-only pid
    return /^\d+$/.test(label) ? `¶${label}` : `(${label})`;
  });
  return labels.join(", ");
}
