"use client";

interface Props {
  selectedCount: number;
  allHighlighted: boolean;
  onHighlight: () => void;
  onNote: () => void;
  onCopy: () => void;
  onClear: () => void;
}

export function ActionBar({ selectedCount, allHighlighted, onHighlight, onNote, onCopy, onClear }: Props) {
  const visible = selectedCount > 0;

  return (
    <>
      <div
        className="action-bar-outer"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          zIndex: 150,
          pointerEvents: "none",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          className="action-bar-inner"
          style={{
            width: "100%",
            background: "var(--white)",
            borderTop: "1px solid var(--border)",
            padding: "10px 16px",
            paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
            pointerEvents: "auto",
          }}
        >
      {/* Selection info */}
      <div style={{
        fontSize: 12, color: "var(--text3)", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          fontWeight: 600, color: "var(--accent)",
          background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
          padding: "1px 8px", borderRadius: 10, fontSize: 11.5,
        }}>
          {selectedCount === 1 ? "1 paragraph" : `${selectedCount} paragraphs`}
        </span>
        <span>selected</span>
        <span
          onClick={onClear}
          style={{ marginLeft: "auto", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}
        >
          Clear
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        {/* Highlight / Remove Highlight */}
        <button
          onClick={onHighlight}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 16px", borderRadius: 9,
            border: allHighlighted ? "1px solid var(--yellow-hl-border)" : "1px solid var(--border)",
            background: allHighlighted ? "var(--yellow-hl)" : "var(--bg2)",
            fontSize: 13.5, fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            color: allHighlighted ? "#5a4400" : "var(--text)",
            cursor: "pointer", transition: "all 0.15s", flex: 1.5,
          }}
        >
          {allHighlighted ? (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Remove
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Highlight
            </>
          )}
        </button>

        {/* Add Note */}
        <button
          onClick={onNote}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 16px", borderRadius: 9,
            border: "1px solid var(--border)",
            background: "var(--bg2)",
            fontSize: 13.5, fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            color: "var(--text)", cursor: "pointer",
            transition: "all 0.15s", flex: 1,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Note
        </button>

        {/* Copy */}
        <button
          onClick={onCopy}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 13px", borderRadius: 9,
            border: "1px solid var(--border)",
            background: "var(--bg2)",
            fontSize: 13.5, fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            color: "var(--text)", cursor: "pointer",
            transition: "all 0.15s", flex: "none",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </div>
        </div>
      </div>

      {/* Responsive: on desktop, float as a card; on mobile, full-width */}
      <style>{`
        @media (min-width: 900px) {
          .action-bar-outer {
            bottom: 16px !important;
            padding: 0 24px;
          }
          .action-bar-inner {
            max-width: 680px;
            border-radius: 14px !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 8px 40px rgba(0,0,0,0.12) !important;
          }
        }
      `}</style>
    </>
  );
}
