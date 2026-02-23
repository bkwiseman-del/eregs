"use client";

import { useState, useEffect } from "react";
import type { EcfrSection, PartToc } from "@/lib/ecfr";
import { TopNav } from "./TopNav";
import { NavRail } from "./NavRail";
import { ReaderSidebar } from "./ReaderSidebar";
import { ReaderContent } from "./ReaderContent";
import { InsightsPanel } from "./InsightsPanel";

interface Props {
  section: EcfrSection;
  toc: PartToc | null;
  adjacent: { prev: string | null; next: string | null };
  slug: string;
}

export function ReaderShell({ section, toc, adjacent, slug }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopNav
        section={section}
        insightsOpen={insightsOpen}
        onToggleInsights={() => setInsightsOpen(v => !v)}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
        isMobile={isMobile}
      />

      {/* Shell: everything below the top nav */}
      <div style={{
        position: "fixed",
        top: "var(--nav-h)", bottom: 0, left: 0, right: 0,
        display: "flex", overflow: "hidden"
      }}>
        {/* Nav Rail — desktop only */}
        {!isMobile && <NavRail />}

        {/* TOC Sidebar */}
        <ReaderSidebar
          toc={toc}
          currentSection={section.section}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
        />

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 25, top: "var(--nav-h)"
            }}
          />
        )}

        {/* Main reading pane */}
        <main style={{ flex: 1, overflowY: "auto", minWidth: 0, background: "var(--bg)" }}>
          <ReaderContent section={section} adjacent={adjacent} />
        </main>

        {/* Insights panel */}
        <InsightsPanel
          section={section}
          open={insightsOpen}
          onClose={() => setInsightsOpen(false)}
        />
      </div>
    </div>
  );
}
