"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PartToc } from "@/lib/ecfr";
import { NavRail } from "@/components/reader/NavRail";
import { ReaderSidebar } from "@/components/reader/ReaderSidebar";
import { ResizeHandle } from "@/components/reader/ResizeHandle";
import { MobileBottomTabs } from "@/components/shared/MobileBottomTabs";
import { AppNav } from "@/components/shared/AppNav";

const TOC_MIN = 200, TOC_MAX = 420, TOC_DEFAULT = 290;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function AnnotationPageLayout({
  children,
  isPaid = false,
}: {
  children: React.ReactNode;
  isPaid?: boolean;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [tocWidth, setTocWidth] = useState(TOC_DEFAULT);
  const [allTocs, setAllTocs] = useState<Map<string, PartToc>>(new Map());

  // Restore TOC state from localStorage after hydration
  useEffect(() => {
    const savedWidth = localStorage.getItem("eregs-toc-width");
    if (savedWidth) setTocWidth(Math.max(TOC_MIN, Math.min(TOC_MAX, Number(savedWidth))));
    if (localStorage.getItem("eregs-toc-collapsed") === "1") setTocCollapsed(true);
  }, []);

  const handleTocResize = useCallback((delta: number) => {
    setTocWidth(w => {
      const next = Math.min(TOC_MAX, Math.max(TOC_MIN, w + delta));
      localStorage.setItem("eregs-toc-width", String(next));
      return next;
    });
  }, []);

  const toggleTocCollapse = useCallback(() => {
    setTocCollapsed(c => {
      localStorage.setItem("eregs-toc-collapsed", c ? "0" : "1");
      return !c;
    });
  }, []);

  // Fetch the initial TOC for the default part on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reader-data?part=390&toc=1");
        if (!res.ok) return;
        const data = await res.json();
        if (data.toc) {
          setAllTocs(prev => {
            const next = new Map(prev);
            next.set("390", data.toc);
            return next;
          });
        }
      } catch { /* silent */ }
    })();
  }, []);

  const fetchTocForPart = useCallback(async (part: string) => {
    if (allTocs.has(part)) return;
    try {
      const res = await fetch(`/api/reader-data?part=${part}&toc=1`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.toc) {
        setAllTocs(prev => {
          const next = new Map(prev);
          next.set(part, data.toc);
          return next;
        });
      }
    } catch { /* silent */ }
  }, [allTocs]);

  const handleNavigate = useCallback((section: string) => {
    router.push(`/regs/${section}`);
  }, [router]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppNav
        isMobile={isMobile}
        leftAction={!isMobile ? (
          <button onClick={toggleTocCollapse} title={tocCollapsed ? "Show table of contents" : "Hide table of contents"} style={{
            width: 34, height: 34, borderRadius: 8,
            border: tocCollapsed ? "1px solid var(--border)" : "1px solid var(--accent-border)",
            background: tocCollapsed ? "var(--white)" : "var(--accent-bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: tocCollapsed ? "var(--text2)" : "var(--accent)",
            cursor: "pointer", flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        ) : undefined}
      />

      {/* Body */}
      <div style={{
        position: "fixed", top: "var(--nav-h)", bottom: 0, left: 0, right: 0,
        display: "flex", overflow: "hidden",
      }}>
        {!isMobile && <NavRail isPaid={isPaid} />}

        {/* Desktop TOC sidebar with resize handle */}
        {!isMobile && !tocCollapsed && (
          <>
            <ReaderSidebar
              allTocs={allTocs}
              currentSection=""
              open={true}
              onClose={() => {}}
              isMobile={false}
              onNavigate={handleNavigate}
              onExpandPart={fetchTocForPart}
              width={tocWidth}
            />
            <ResizeHandle
              side="left"
              onResize={handleTocResize}
              onDoubleClick={toggleTocCollapse}
            />
          </>
        )}

        {/* Collapsed TOC tab */}
        {!isMobile && tocCollapsed && (
          <div
            onClick={toggleTocCollapse}
            title="Expand table of contents"
            style={{
              width: 28, flexShrink: 0, background: "var(--white)",
              borderRight: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", writingMode: "vertical-rl",
              fontSize: 10, fontWeight: 600, color: "var(--text3)",
              letterSpacing: "0.08em", textTransform: "uppercase",
              userSelect: "none",
            }}
          >
            <span style={{ transform: "rotate(180deg)" }}>Contents</span>
          </div>
        )}

        <main style={{
          flex: 1, overflowY: "auto", minWidth: 0, background: "var(--bg)",
          WebkitOverflowScrolling: "touch",
        }}>
          {children}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      {isMobile && <MobileBottomTabs isPaid={isPaid} />}
    </div>
  );
}
