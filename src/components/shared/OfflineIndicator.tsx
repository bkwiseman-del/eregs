"use client";

import { usePWA } from "./ServiceWorkerProvider";

export function OfflineIndicator() {
  const { isOffline } = usePWA();

  if (!isOffline) return null;

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
        padding: "6px 12px",
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
    </div>
  );
}
