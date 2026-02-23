"use client";

import { useState, useEffect } from "react";
import type { EcfrSection, PartToc } from "@/lib/ecfr";
import { ReaderNav } from "./ReaderNav";
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
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden font-sans">
      {/* Left nav rail */}
      <ReaderNav
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleInsights={() => setInsightsOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        insightsOpen={insightsOpen}
        slug={slug}
      />

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
          className="fixed inset-0 bg-black/40 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <ReaderContent section={section} adjacent={adjacent} />
      </main>

      {/* Insights panel */}
      <InsightsPanel
        section={section}
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
      />
    </div>
  );
}
