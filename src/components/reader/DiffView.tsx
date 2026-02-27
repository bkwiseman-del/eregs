"use client";

import type { EcfrNode } from "@/lib/ecfr";
import type { DiffResult, DiffSegment } from "@/lib/diff";

interface Props {
  results: DiffResult[];
  historicalDate: string;
}

export function DiffView({ results, historicalDate }: Props) {
  const formatted = new Date(historicalDate + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  const hasChanges = results.some(r => r.type !== "unchanged");

  if (!hasChanges) {
    return (
      <div style={{
        textAlign: "center", padding: "32px 16px",
        color: "var(--text3)", fontSize: 13,
      }}>
        No changes between {formatted} and the current version.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        fontSize: 11, color: "var(--text3)", marginBottom: 24,
        padding: "8px 12px", background: "var(--bg)", borderRadius: 6,
        border: "1px solid var(--border)",
      }}>
        <span style={{ fontWeight: 500, color: "var(--text2)" }}>
          Changes: {formatted} → current
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#dcfce7", border: "1px solid #86efac" }} />
          Added
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#fef2f2", border: "1px solid #fecaca" }} />
          Removed
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#fefce8", border: "1px solid #fde68a" }} />
          Modified
        </span>
      </div>

      {/* Diff content */}
      {results.map((result, i) => (
        <DiffNode key={i} result={result} />
      ))}
    </div>
  );
}

function DiffNode({ result }: { result: DiffResult }) {
  switch (result.type) {
    case "unchanged":
      return <UnchangedNode node={result.newNode!} />;
    case "modified":
      return <ModifiedNode result={result} />;
    case "added":
      return <AddedNode node={result.newNode!} />;
    case "removed":
      return <RemovedNode node={result.oldNode!} />;
  }
}

// ── Unchanged ────────────────────────────────────────────────────────────────

function UnchangedNode({ node }: { node: EcfrNode }) {
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];

  if (node.type === "heading") return <DiffHeading node={node} />;
  if (node.type === "table") return <DiffTable node={node} />;
  if (node.type === "image") return null; // skip images in diff for clarity

  return (
    <div style={{
      display: "flex", gap: 0,
      padding: "10px 10px", paddingLeft: indent + 10,
      margin: "0 -10px 2px",
      borderRadius: 8,
      border: "1.5px solid transparent",
    }}>
      {node.label && (
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 13.5, fontStyle: "italic",
          color: "var(--text3)", minWidth: 32, flexShrink: 0,
          paddingTop: 3, paddingRight: 8, whiteSpace: "nowrap",
        }}>
          ({node.label})
        </span>
      )}
      <span style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 15.5, lineHeight: 1.82, color: "var(--text)",
        flex: 1, minWidth: 0,
      }}>
        {node.text}
      </span>
    </div>
  );
}

// ── Modified ─────────────────────────────────────────────────────────────────

function ModifiedNode({ result }: { result: DiffResult }) {
  const node = result.newNode!;
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];

  if (node.type === "heading") {
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: node.headingLevel === 1 ? 17 : node.headingLevel === 2 ? 15 : 14,
        fontWeight: 600, color: "var(--text)",
        marginTop: node.headingLevel === 1 ? 32 : node.headingLevel === 2 ? 24 : 18,
        marginBottom: 8,
        borderLeft: "3px solid #fde68a",
        paddingLeft: 10,
        background: "#fefce8",
        borderRadius: 4,
        padding: "4px 10px",
      }}>
        <DiffSegments segments={result.textDiff ?? []} />
      </div>
    );
  }

  if (node.type === "table") {
    // Show both old and new tables stacked
    return (
      <div style={{ margin: "12px 0" }}>
        {result.oldNode && (
          <div style={{ borderLeft: "3px solid #fecaca", paddingLeft: 10, marginBottom: 8, opacity: 0.7 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>Previous</div>
            <DiffTable node={result.oldNode} />
          </div>
        )}
        <div style={{ borderLeft: "3px solid #86efac", paddingLeft: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#166534", marginBottom: 4 }}>Current</div>
          <DiffTable node={node} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", gap: 0,
      padding: "10px 10px", paddingLeft: indent + 10,
      margin: "0 -10px 2px",
      borderRadius: 8,
      border: "1.5px solid #fde68a",
      borderLeft: "3px solid #f59e0b",
      background: "#fefce8",
    }}>
      {node.label && (
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 13.5, fontStyle: "italic",
          color: "#92400e", minWidth: 32, flexShrink: 0,
          paddingTop: 3, paddingRight: 8, whiteSpace: "nowrap",
        }}>
          ({node.label})
        </span>
      )}
      <span style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 15.5, lineHeight: 1.82, color: "var(--text)",
        flex: 1, minWidth: 0,
      }}>
        <DiffSegments segments={result.textDiff ?? []} />
      </span>
    </div>
  );
}

// ── Added ────────────────────────────────────────────────────────────────────

function AddedNode({ node }: { node: EcfrNode }) {
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];

  if (node.type === "heading") {
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: node.headingLevel === 1 ? 17 : node.headingLevel === 2 ? 15 : 14,
        fontWeight: 600, color: "#166534",
        marginTop: node.headingLevel === 1 ? 32 : node.headingLevel === 2 ? 24 : 18,
        marginBottom: 8,
        borderLeft: "3px solid #86efac",
        background: "#f0fdf4",
        borderRadius: 4,
        padding: "4px 10px",
      }}>
        <Badge type="added" />
        {node.text}
      </div>
    );
  }

  if (node.type === "table") {
    return (
      <div style={{ borderLeft: "3px solid #86efac", paddingLeft: 10, margin: "12px 0", background: "#f0fdf4", borderRadius: 4, padding: "8px 10px" }}>
        <Badge type="added" />
        <DiffTable node={node} />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", gap: 0,
      padding: "10px 10px", paddingLeft: indent + 10,
      margin: "0 -10px 2px",
      borderRadius: 8,
      border: "1.5px solid #bbf7d0",
      borderLeft: "3px solid #22c55e",
      background: "#f0fdf4",
      position: "relative",
    }}>
      <Badge type="added" />
      {node.label && (
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 13.5, fontStyle: "italic",
          color: "#166534", minWidth: 32, flexShrink: 0,
          paddingTop: 3, paddingRight: 8, whiteSpace: "nowrap",
        }}>
          ({node.label})
        </span>
      )}
      <span style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 15.5, lineHeight: 1.82, color: "#166534",
        flex: 1, minWidth: 0,
      }}>
        {node.text}
      </span>
    </div>
  );
}

// ── Removed ──────────────────────────────────────────────────────────────────

function RemovedNode({ node }: { node: EcfrNode }) {
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];

  if (node.type === "heading") {
    return (
      <div style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: node.headingLevel === 1 ? 17 : node.headingLevel === 2 ? 15 : 14,
        fontWeight: 600, color: "#dc2626",
        marginTop: node.headingLevel === 1 ? 32 : node.headingLevel === 2 ? 24 : 18,
        marginBottom: 8,
        borderLeft: "3px solid #fecaca",
        background: "#fef2f2",
        borderRadius: 4,
        padding: "4px 10px",
        textDecoration: "line-through",
        opacity: 0.7,
      }}>
        <Badge type="removed" />
        {node.text}
      </div>
    );
  }

  if (node.type === "table") {
    return (
      <div style={{ borderLeft: "3px solid #fecaca", paddingLeft: 10, margin: "12px 0", background: "#fef2f2", borderRadius: 4, padding: "8px 10px", opacity: 0.7 }}>
        <Badge type="removed" />
        <DiffTable node={node} />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", gap: 0,
      padding: "10px 10px", paddingLeft: indent + 10,
      margin: "0 -10px 2px",
      borderRadius: 8,
      border: "1.5px solid #fecaca",
      borderLeft: "3px solid #ef4444",
      background: "#fef2f2",
      opacity: 0.7,
      position: "relative",
    }}>
      <Badge type="removed" />
      {node.label && (
        <span style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 13.5, fontStyle: "italic",
          color: "#dc2626", minWidth: 32, flexShrink: 0,
          paddingTop: 3, paddingRight: 8, whiteSpace: "nowrap",
          textDecoration: "line-through",
        }}>
          ({node.label})
        </span>
      )}
      <span style={{
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 15.5, lineHeight: 1.82, color: "#dc2626",
        flex: 1, minWidth: 0,
        textDecoration: "line-through",
      }}>
        {node.text}
      </span>
    </div>
  );
}

// ── Inline diff segments ─────────────────────────────────────────────────────

function DiffSegments({ segments }: { segments: DiffSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.text}</span>;
        if (seg.type === "delete") {
          return (
            <span key={i} style={{
              color: "#dc2626", background: "#fef2f2",
              textDecoration: "line-through",
              padding: "1px 2px", borderRadius: 2,
            }}>
              {seg.text}
            </span>
          );
        }
        // insert
        return (
          <span key={i} style={{
            color: "#166534", background: "#dcfce7",
            padding: "1px 2px", borderRadius: 2,
          }}>
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Badge({ type }: { type: "added" | "removed" }) {
  const isAdded = type === "added";
  return (
    <span style={{
      position: "absolute", right: 8, top: 8,
      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.05em",
      padding: "1px 5px", borderRadius: 3,
      background: isAdded ? "#dcfce7" : "#fef2f2",
      color: isAdded ? "#166534" : "#dc2626",
      border: `1px solid ${isAdded ? "#86efac" : "#fecaca"}`,
    }}>
      {isAdded ? "Added" : "Removed"}
    </span>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function DiffHeading({ node }: { node: EcfrNode }) {
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

function DiffTable({ node }: { node: EcfrNode }) {
  return (
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
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
