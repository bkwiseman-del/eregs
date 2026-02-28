"use client";

import { useState } from "react";
import { usePWA } from "./ServiceWorkerProvider";

export function OfflineIndicator() {
  const { isOffline } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isOffline || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#374151",
        color: "#f9fafb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "6px 36px 6px 12px",
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <svg
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
        <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
      </svg>
      You&apos;re offline. Viewing cached regulations.
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9ca3af",
          padding: 4,
          lineHeight: 1,
        }}
      >
        <svg
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
