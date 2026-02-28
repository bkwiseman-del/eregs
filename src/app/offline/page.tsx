"use client";

import { useState, useEffect } from "react";
import { getAllStoredParts } from "@/lib/pwa/db";
import Link from "next/link";

export default function OfflinePage() {
  const [cachedParts, setCachedParts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllStoredParts()
      .then(setCachedParts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 24,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--bg2, #f3f1ee)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <svg
          width="28"
          height="28"
          fill="none"
          stroke="var(--text3, #9a948e)"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.56 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          marginBottom: 8,
          color: "var(--text, #1a1814)",
        }}
      >
        You&apos;re offline
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text3, #9a948e)",
          marginBottom: 24,
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.5,
        }}
      >
        This page hasn&apos;t been cached for offline use.
        {cachedParts.length > 0 &&
          " You can browse the parts you've already visited:"}
      </p>

      {!loading && cachedParts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          {cachedParts
            .sort((a, b) => Number(a) - Number(b))
            .map((part) => (
              <Link
                key={part}
                href={`/regs/${part}.1`}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border, #e5e1db)",
                  background: "var(--white, #fff)",
                  color: "var(--accent, #c96a2a)",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Part {part}
              </Link>
            ))}
        </div>
      )}

      <button
        onClick={() => window.location.reload()}
        style={{
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 500,
          background: "var(--accent, #c96a2a)",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
