"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export function ReaderShell({ section: initialSection, toc, adjacent: initialAdjacent, slug }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Client-side section management
  const [currentSection, setCurrentSection] = useState<EcfrSection>(initialSection);
  const [adjacent, setAdjacent] = useState(initialAdjacent);
  const [partSections, setPartSections] = useState<Map<string, EcfrSection>>(new Map());
  const [loadingPart, setLoadingPart] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const currentPart = currentSection.section.split(".")[0];

  // Build adjacent from TOC
  const computeAdjacent = useCallback((sectionId: string, tocData: PartToc | null) => {
    if (!tocData) return { prev: null, next: null };
    const allSections = tocData.subparts.flatMap(sp => sp.sections);
    const idx = allSections.findIndex(s => s.section === sectionId);
    return {
      prev: idx > 0 ? allSections[idx - 1].section : null,
      next: idx < allSections.length - 1 ? allSections[idx + 1].section : null,
    };
  }, []);

  // Fetch all sections for the current part
  useEffect(() => {
    const part = currentSection.section.split(".")[0];
    if (partSections.has(currentSection.section)) return; // Already loaded

    setLoadingPart(part);
    fetch(`/api/part-sections?part=${part}`)
      .then(r => r.json())
      .then((sections: EcfrSection[]) => {
        setPartSections(prev => {
          const next = new Map(prev);
          for (const s of sections) {
            next.set(s.section, s);
          }
          return next;
        });
        setLoadingPart(null);
      })
      .catch(() => setLoadingPart(null));
  }, [currentPart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to a section (client-side)
  const navigateTo = useCallback((sectionId: string) => {
    // Check if we have it cached
    const cached = partSections.get(sectionId);
    if (cached) {
      setCurrentSection(cached);
      setAdjacent(computeAdjacent(sectionId, toc));
      // Update URL without reload
      window.history.pushState(null, "", `/regs/${sectionId}`);
      // Update document title
      document.title = `§ ${cached.section} ${cached.title} | eRegs`;
      // Scroll to top
      mainRef.current?.scrollTo(0, 0);
      return;
    }

    // Not cached yet — navigate with full page load as fallback
    window.location.href = `/regs/${sectionId}`;
  }, [partSections, toc, computeAdjacent]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/regs\/(.+)/);
      if (match) {
        const sectionId = match[1];
        const cached = partSections.get(sectionId);
        if (cached) {
          setCurrentSection(cached);
          setAdjacent(computeAdjacent(sectionId, toc));
          mainRef.current?.scrollTo(0, 0);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [partSections, toc, computeAdjacent]);

  // Responsive check
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

  // Sync initial section into partSections cache
  useEffect(() => {
    setPartSections(prev => {
      if (prev.has(initialSection.section)) return prev;
      const next = new Map(prev);
      next.set(initialSection.section, initialSection);
      return next;
    });
  }, [initialSection]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopNav
        section={currentSection}
        insightsOpen={insightsOpen}
        onToggleInsights={() => setInsightsOpen(v => !v)}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
        isMobile={isMobile}
      />

      <div style={{
        position: "fixed",
        top: "var(--nav-h)", bottom: 0, left: 0, right: 0,
        display: "flex", overflow: "hidden"
      }}>
        {!isMobile && <NavRail />}

        <ReaderSidebar
          toc={toc}
          currentSection={currentSection.section}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          onNavigate={navigateTo}
        />

        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 25, top: "var(--nav-h)"
            }}
          />
        )}

        <main ref={mainRef} style={{ flex: 1, overflowY: "auto", minWidth: 0, background: "var(--bg)" }}>
          <ReaderContent section={currentSection} adjacent={adjacent} onNavigate={navigateTo} />
        </main>

        <InsightsPanel
          section={currentSection}
          open={insightsOpen}
          onClose={() => setInsightsOpen(false)}
        />
      </div>
    </div>
  );
}
