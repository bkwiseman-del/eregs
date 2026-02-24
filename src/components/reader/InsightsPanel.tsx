"use client";

import type { EcfrSection } from "@/lib/ecfr";

interface Props {
  section: EcfrSection;
  open: boolean;
  onClose: () => void;
  width?: number;
}

const guidance = [
  {
    eye: "FMCSA Interpretation",
    title: "Interstate Commerce — Trip Intent Test",
    body: "A carrier's operations are interstate even if both origin and destination are in the same state, provided the shipment is part of a continuous interstate movement.",
    src: `§ 390.5(n) · fmcsa.dot.gov`,
  },
  {
    eye: "FMCSA Interpretation",
    title: "CMV Weight Threshold — GCWR vs. GVWR",
    body: "When towing, use the higher of GCWR or GVWR. A vehicle below threshold alone may qualify as a CMV based on combined weight.",
    src: `§ 390.5(b)(j)(k) · fmcsa.dot.gov`,
  },
  {
    eye: "FMCSA Interpretation",
    title: "Private Motor Carrier — For-Hire Test",
    body: "A company is a private motor carrier when it transports its own goods. If it occasionally transports goods for others for compensation it may be reclassified as for-hire.",
    src: `§ 390.5(u) · fmcsa.dot.gov`,
  },
];

const IPCard = ({ card }: { card: typeof guidance[0] }) => (
  <div style={{
    border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
    marginBottom: 8, background: "var(--white)"
  }}>
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 6,
      fontSize: 10, fontWeight: 600, color: "var(--blue)",
      background: "var(--blue-bg)", border: "1px solid var(--blue-border)",
      borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em"
    }}>
      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {card.eye}
    </div>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginBottom: 5, lineHeight: 1.35 }}>
      {card.title}
    </div>
    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8 }}>
      {card.body}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text3)" }}>
      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
      {card.src}
    </div>
  </div>
);

export function InsightsPanel({ section, open, onClose, width = 296 }: Props) {
  const [activeTab, setActiveTab] = useState<"guidance" | "videos" | "articles">("guidance");

  if (!open) return null;

  return (
    <aside style={{
      width, flexShrink: 0, background: "var(--white)",
      borderLeft: "none", display: "flex",
      flexDirection: "column", overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>
          § {section.section} Insights
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
          {(["guidance", "videos", "articles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 12px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 12.5, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "var(--accent)" : "var(--text3)",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: -1, textTransform: "capitalize", transition: "all 0.15s"
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px" }}>
        {activeTab === "guidance" && (
          <>
            {guidance.map((card, i) => <IPCard key={i} card={card} />)}
          </>
        )}
        {activeTab === "videos" && (
          <div style={{ paddingTop: 4 }}>
            {[
              { title: "Are You a CMV? Understanding the Thresholds", duration: "9 min", color: "#1a2a3a" },
              { title: "Interstate vs. Intrastate Commerce Explained", duration: "11 min", color: "#1a3a2e" },
            ].map((v, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, cursor: "pointer" }}>
                <div style={{
                  width: 72, height: 48, borderRadius: 6, flexShrink: 0,
                  background: `linear-gradient(135deg, ${v.color}, var(--accent))`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.9)",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <svg width="10" height="10" fill="var(--accent)" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", lineHeight: 1.35, marginBottom: 3 }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Trucksafe · {v.duration}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "articles" && (
          <>
            {[
              { title: "Does the 10,001 lb. Rule Apply to Your Fleet?", meta: "Trucksafe · Nov 2025 · 7 min read" },
              { title: "Private vs. For-Hire: Understanding Your Carrier Classification", meta: "Trucksafe · Sep 2025 · 5 min read" },
            ].map((a, i) => (
              <div key={i} style={{
                border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
                marginBottom: 8, cursor: "pointer"
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35, marginBottom: 6 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.meta}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, color: "var(--text3)", lineHeight: 1.4 }}>
          Insights are for informational purposes only and do not constitute legal advice.
        </div>
      </div>
    </aside>
  );
}

// Need to import useState
import { useState } from "react";
