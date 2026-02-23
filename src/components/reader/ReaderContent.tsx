import Link from "next/link";
import type { EcfrSection, EcfrNode } from "@/lib/ecfr";

interface Props {
  section: EcfrSection;
  adjacent: { prev: string | null; next: string | null };
}

function renderNode(node: EcfrNode) {
  const indent = node.level * 20;
  return (
    <div key={node.id} style={{ paddingLeft: indent, marginBottom: 8 }}>
      <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text)", fontFamily: "'Lora', Georgia, serif" }}>
        {node.label && (
          <span style={{ fontWeight: 600, color: "var(--text2)", marginRight: 4 }}>({node.label})</span>
        )}
        {node.text}
      </p>
    </div>
  );
}

export function ReaderContent({ section, adjacent }: Props) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 120px" }}>
      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 0", borderBottom: "1px solid var(--border)", marginBottom: 28
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "var(--green)",
            display: "inline-block"
          }} />
          Viewing current version
        </span>
        <a
          href={`https://www.ecfr.gov/current/title-49/section-${section.section}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text3)", textDecoration: "none" }}
        >
          eCFR
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
        </a>
      </div>

      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        {section.subpartLabel && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Subpart {section.subpartLabel} — {section.subpartTitle}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
          § {section.section}
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 700, color: "var(--text)",
          fontFamily: "'Lora', Georgia, serif", lineHeight: 1.2
        }}>
          {section.title}
        </h1>
        <div style={{ marginTop: 16, height: 1, background: "var(--border)" }} />
      </div>

      {/* Regulation text */}
      <div style={{ marginBottom: 48 }}>
        {section.content.map(node => renderNode(node))}
      </div>

      {/* Prev / Next navigation */}
      <div style={{
        display: "flex", justifyContent: "space-between", gap: 12,
        paddingTop: 24, borderTop: "1px solid var(--border)"
      }}>
        {adjacent.prev ? (
          <Link href={`/regs/${adjacent.prev}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
              border: "1px solid var(--border)", borderRadius: 8, background: "var(--white)",
              cursor: "pointer", color: "var(--text2)", fontSize: 13, transition: "all 0.15s"
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
              cursor: "pointer", color: "var(--text2)", fontSize: 13, transition: "all 0.15s"
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
