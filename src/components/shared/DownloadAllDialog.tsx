"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAllStoredParts,
  storePartData,
} from "@/lib/pwa/db";

const ALL_PARTS = [
  "383", "385", "386", "387", "390", "391", "392", "393",
  "395", "396", "397", "398", "399",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DownloadAllDialog({ open, onClose }: Props) {
  const [cachedParts, setCachedParts] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getAllStoredParts().then((parts) => setCachedParts(new Set(parts)));
  }, [open]);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    setError(null);
    const partsToDownload = ALL_PARTS.filter((p) => !cachedParts.has(p));
    setProgress({ current: 0, total: partsToDownload.length });

    for (let i = 0; i < partsToDownload.length; i++) {
      const part = partsToDownload[i];
      try {
        const res = await fetch(`/api/reader-data?part=${part}`);
        if (!res.ok) throw new Error(`Failed to fetch part ${part}`);
        const data = await res.json();

        await storePartData({
          part,
          toc: data.toc ?? null,
          sections: data.sections ?? [],
          meta: data.meta ?? { ecfrVersion: null, cachedAt: null },
          storedAt: new Date().toISOString(),
        });

        // Also put in Cache API so SW can serve it
        const cache = await caches.open("eregs-v1-data");
        await cache.put(
          new Request(`/api/reader-data?part=${part}`),
          new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          })
        );

        setCachedParts((prev) => new Set([...prev, part]));
        setProgress({ current: i + 1, total: partsToDownload.length });
      } catch {
        setError(`Failed to download Part ${part}. Check your connection.`);
        break;
      }
    }

    setDownloading(false);
  }, [cachedParts]);

  if (!open) return null;

  const cachedCount = cachedParts.size;
  const totalParts = ALL_PARTS.length;
  const allCached = cachedCount >= totalParts;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--white, #fff)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <h3
          style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}
        >
          Download All Regulations
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text3, #9a948e)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Download all {totalParts} FMCSR parts for offline access.
          {cachedCount > 0 &&
            ` ${cachedCount} of ${totalParts} already cached.`}
        </p>

        {downloading && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                width: "100%",
                height: 6,
                background: "var(--bg2, #f3f1ee)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  height: "100%",
                  background: "var(--accent, #c96a2a)",
                  borderRadius: 3,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text3, #9a948e)",
                marginTop: 6,
              }}
            >
              Downloading part {progress.current} of {progress.total}...
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 12,
              color: "#dc2626",
              marginBottom: 12,
              padding: "8px 12px",
              background: "#fef2f2",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: "var(--bg2, #f3f1ee)",
              border: "1px solid var(--border, #e5e1db)",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {allCached ? "Done" : "Cancel"}
          </button>

          {!allCached && (
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                background: downloading
                  ? "var(--text3, #9a948e)"
                  : "var(--accent, #c96a2a)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: downloading ? "not-allowed" : "pointer",
                opacity: downloading ? 0.7 : 1,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {downloading
                ? "Downloading..."
                : cachedCount > 0
                  ? `Download remaining ${totalParts - cachedCount} parts`
                  : "Download all"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
