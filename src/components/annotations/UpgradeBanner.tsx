"use client";

/**
 * UpgradeBanner — Shown on /notes, /highlights, /saved for free/unauthed users.
 * Full-page CTA that sells the value of Pro features.
 * Designed to work well on mobile (PWA-ready) and desktop.
 */
export function UpgradeBanner({
  feature,
  description,
  icon,
}: {
  feature: string;           // e.g. "Notes", "Highlights", "Bookmarks"
  description: string;       // Contextual sell for this specific feature
  icon: React.ReactNode;
}) {
  const features = [
    { text: "Highlight paragraphs & add notes, synced across all your devices", icon: "highlight" },
    { text: "Copy with full CFR citation in one tap", icon: "copy" },
    { text: "FMCSA guidance & official interpretations mapped to each rule", icon: "guidance" },
    { text: "Trucksafe videos, articles & podcast — right in context", icon: "media" },
    { text: "Alerts when your annotated sections change", icon: "alert" },
  ];

  return (
    <div style={{
      maxWidth: 520, margin: "0 auto", padding: "48px 20px 80px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--accent)", marginBottom: 20,
      }}>
        {icon}
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 500,
        color: "var(--text)", textAlign: "center", marginBottom: 8,
        lineHeight: 1.3,
      }}>
        {feature} are a Pro feature
      </h1>

      {/* Description */}
      <p style={{
        fontSize: 14, color: "var(--text2)", textAlign: "center",
        lineHeight: 1.6, maxWidth: 400, marginBottom: 32,
      }}>
        {description}
      </p>

      {/* CTA */}
      <a
        href="/login"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "13px 32px", borderRadius: 10,
          background: "var(--accent)", color: "white",
          fontSize: 15, fontWeight: 600, fontFamily: "'Inter', sans-serif",
          textDecoration: "none", cursor: "pointer",
          transition: "background 0.15s", width: "100%", maxWidth: 320,
          marginBottom: 10,
        }}
      >
        Start Free 14-Day Trial
      </a>

      <a
        href="/login"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "11px 32px", borderRadius: 10,
          background: "var(--bg2)", border: "1px solid var(--border)",
          color: "var(--text2)", fontSize: 14, fontWeight: 500,
          fontFamily: "'Inter', sans-serif", textDecoration: "none",
          cursor: "pointer", transition: "all 0.15s",
          width: "100%", maxWidth: 320, marginBottom: 24,
        }}
      >
        Sign in to existing account
      </a>

      <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 36 }}>
        $4/month after trial · No credit card required
      </p>

      {/* Feature list */}
      <div style={{
        width: "100%", maxWidth: 400,
        background: "var(--white)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "20px 20px 16px",
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: "var(--text3)",
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 14,
        }}>
          Everything in Pro
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg
                width="16" height="16" fill="none" stroke="var(--green)"
                strokeWidth="2.5" viewBox="0 0 24 24"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                {f.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom navigation hint */}
      <a
        href="/regs/390.1"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          marginTop: 28, fontSize: 13, color: "var(--text3)",
          textDecoration: "none", transition: "color 0.15s",
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Continue reading for free
      </a>
    </div>
  );
}
