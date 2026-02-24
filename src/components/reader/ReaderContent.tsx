import Link from "next/link";
import type { EcfrSection, EcfrNode } from "@/lib/ecfr";

interface Props {
  section: EcfrSection;
  adjacent: { prev: string | null; next: string | null };
}

function renderNode(node: EcfrNode) {
  const indentMap = [0, 24, 48, 72, 96, 120, 144];
  const indent = indentMap[Math.min(node.level, 6)];
  const isTopLevel = node.level === 1;

  // TABLE
  if (node.type === "table") {
    return (
      <div key={node.id} style={{ overflowX: "auto", margin: "20px 0" }}>
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
                    color: "var(--text)", fontWeight: 600, fontSize: 12,
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
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
                  }}>
                    {cell}
                  </td>
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
    // Images are cached in our DB and served via /api/ecfr-image?path=...
    const imagePath = node.imageSrc?.startsWith("http")
      ? new URL(node.imageSrc).pathname
      : node.imageSrc;
    const src = `/api/ecfr-image?path=${encodeURIComponent(imagePath || "")}`;
    return (
      <div key={node.id} style={{ margin: "20px 0", textAlign: "center" }}>
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

  // PARAGRAPH
  return (
    <div
      key={node.id}
      style={{
        paddingLeft: indent,
        marginBottom: node.level === 0 ? 16 : isTopLevel ? 12 : 6,
        marginTop: isTopLevel ? 12 : 0,
      }}
    >
      <p style={{
        fontSize: 15.5, lineHeight: 1.8,
        color: "var(--text)", fontFamily: "'Lora', Georgia, serif",
      }}>
        {node.label && (
          <span style={{ fontWeight: 600, color: "var(--text)", marginRight: 6 }}>
            ({node.label})
          </span>
        )}
        {node.text}
      </p>
    </div>
  );
}

export function ReaderContent({ section, adjacent }: Props) {
  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 24px 120px" }}>
      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 32
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          Viewing current version
        </span>
        <a
          href={`https://www.ecfr.gov/current/title-49/section-${section.section}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text3)", textDecoration: "none" }}
        >
          eCFR
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
        </a>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        {section.subpartLabel && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Subpart {section.subpartLabel} — {section.subpartTitle}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
          § {section.section}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", fontFamily: "'Lora', Georgia, serif", lineHeight: 1.25 }}>
          {section.title}
        </h1>
        <div style={{ marginTop: 20, height: 1, background: "var(--border)" }} />
      </div>

      {/* Regulation content */}
      <div style={{ marginBottom: 48 }}>
        {section.content.map(node => renderNode(node))}
      </div>

      {/* Prev / Next */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
        {adjacent.prev ? (
          <Link href={`/regs/${adjacent.prev}`} style={{ textDecoration: "none" }}>
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
          </Link>
        ) : <div />}

        {adjacent.next && (
          <Link href={`/regs/${adjacent.next}`} style={{ textDecoration: "none" }}>
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
          </Link>
        )}
      </div>
    </div>
  );
}
