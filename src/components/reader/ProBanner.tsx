"use client";

import { useState } from "react";
import Link from "next/link";

export function ProBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div style={{
      margin: "12px 14px 0",
      padding: "12px 14px",
      background: "linear-gradient(135deg, #fdf6f0 0%, #fef9f5 100%)",
      border: "1px solid var(--accent-border)",
      borderRadius: 10,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      position: "relative",
    }}>
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 1,
      }}>
        <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3,
          marginBottom: 4,
        }}>
          Upgrade to eRegs Pro
        </div>
        <div style={{
          fontSize: 12, color: "var(--text2)", lineHeight: 1.55,
        }}>
          Highlight &amp; annotate regulations, get FMCSA guidance as you read, access offline, and keep your fleet compliant.
        </div>

        {/* CTA */}
        <Link href="/login" style={{ textDecoration: "none" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            marginTop: 8, padding: "6px 14px",
            background: "var(--accent)", color: "white",
            fontSize: 12, fontWeight: 600, borderRadius: 7,
            cursor: "pointer", transition: "background 0.15s",
          }}>
            Start free trial
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 8, right: 8,
          width: 22, height: 22, borderRadius: 6,
          border: "none", background: "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text3)", padding: 0,
        }}
      >
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
