export default function SectionLoading() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top nav skeleton */}
      <header style={{
        height: "var(--nav-h, 52px)", display: "flex", alignItems: "center",
        padding: "0 16px", borderBottom: "1px solid var(--border, #e5e1db)",
        background: "var(--white, #fff)", gap: 12, flexShrink: 0,
      }}>
        <div style={{ width: 24, height: 24, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
        <div style={{ width: 120, height: 14, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 80, height: 14, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar skeleton */}
        <aside style={{
          width: 290, flexShrink: 0, borderRight: "1px solid var(--border, #e5e1db)",
          background: "var(--white, #fff)", padding: "12px 0",
        }}>
          <div style={{ padding: "8px 12px" }}>
            <div style={{ width: 140, height: 10, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 12 }} />
            <div style={{ width: 100, height: 13, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 4 }} />
            <div style={{ width: 160, height: 10, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
          </div>
          <div style={{ padding: "8px 0", marginTop: 8 }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{ padding: "7px 12px", display: "flex", gap: 7, alignItems: "center" }}>
                <div style={{ width: 28, height: 11, background: "var(--bg2, #f3f1ee)", borderRadius: 3, flexShrink: 0 }} />
                <div style={{
                  width: `${50 + (i * 13) % 40}%`, height: 11,
                  background: "var(--bg2, #f3f1ee)", borderRadius: 3,
                }} />
              </div>
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg, #faf9f6)" }}>
          <div style={{ maxWidth: 740, margin: "0 auto", padding: "48px 24px" }}>
            {/* Section header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ width: 100, height: 10, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 10 }} />
              <div style={{ width: 60, height: 14, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 10 }} />
              <div style={{ width: "70%", height: 26, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 20 }} />
              <div style={{ height: 1, background: "var(--border, #e5e1db)" }} />
            </div>

            {/* Paragraph skeletons */}
            {[...Array(10)].map((_, i) => (
              <div key={i} style={{
                marginBottom: 14,
                paddingLeft: i % 4 === 0 ? 0 : i % 4 === 1 ? 24 : i % 4 === 2 ? 48 : 24,
              }}>
                <div style={{
                  width: `${60 + (i * 17) % 35}%`, height: 16,
                  background: "var(--bg2, #f3f1ee)", borderRadius: 4,
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.08}s`,
                }} />
              </div>
            ))}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
