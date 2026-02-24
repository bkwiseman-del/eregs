export default function SectionLoading() {
  return (
    <div style={{
      maxWidth: 740, margin: "0 auto", padding: "48px 24px",
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Status bar skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border, #e5e1db)", marginBottom: 32 }}>
        <div style={{ width: 160, height: 12, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
        <div style={{ width: 40, height: 12, background: "var(--bg2, #f3f1ee)", borderRadius: 4 }} />
      </div>

      {/* Section header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ width: 100, height: 10, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ width: 60, height: 14, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ width: "70%", height: 26, background: "var(--bg2, #f3f1ee)", borderRadius: 4, marginBottom: 20 }} />
        <div style={{ height: 1, background: "var(--border, #e5e1db)" }} />
      </div>

      {/* Content skeleton */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          marginBottom: 14,
          paddingLeft: i % 3 === 0 ? 0 : i % 3 === 1 ? 24 : 48,
        }}>
          <div style={{
            width: `${70 + Math.random() * 30}%`, height: 16,
            background: "var(--bg2, #f3f1ee)", borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }} />
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
