"use client";

export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "60vh", padding: 24,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
        Couldn&apos;t load this section
      </h2>
      <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 24, textAlign: "center", maxWidth: 400 }}>
        The regulation server may be slow to respond. This usually resolves on retry.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px", fontSize: 14, fontWeight: 500,
          background: "var(--accent, #c96a2a)", color: "white",
          border: "none", borderRadius: 8, cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Try again
      </button>
    </div>
  );
}
