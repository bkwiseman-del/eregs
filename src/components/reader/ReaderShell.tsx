"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { EcfrSection, PartToc } from "@/lib/ecfr";
import { TopNav } from "./TopNav";
import { NavRail } from "./NavRail";
import { ReaderSidebar } from "./ReaderSidebar";
import { ReaderContent } from "./ReaderContent";
import { InsightsPanel } from "./InsightsPanel";

// ── DATA STORE ──────────────────────────────────────────────────────────────

interface PartData {
  toc: PartToc | null;
  sections: Map<string, EcfrSection>;
}

/** In-memory store of all loaded regulation data. Survives re-renders. */
const globalStore: Map<string, PartData> = new Map();

function storePartToc(part: string, toc: PartToc) {
  const existing = globalStore.get(part);
  if (existing) {
    existing.toc = toc;
  } else {
    globalStore.set(part, { toc, sections: new Map() });
  }
}

function storePartSections(part: string, sections: EcfrSection[]) {
  const existing = globalStore.get(part);
  if (existing) {
    for (const s of sections) existing.sections.set(s.section, s);
  } else {
    const map = new Map<string, EcfrSection>();
    for (const s of sections) map.set(s.section, s);
    globalStore.set(part, { toc: null, sections: map });
  }
}

function getSection(sectionId: string): EcfrSection | null {
  const part = sectionId.split(".")[0];
  return globalStore.get(part)?.sections.get(sectionId) ?? null;
}

function getToc(part: string): PartToc | null {
  return globalStore.get(part)?.toc ?? null;
}

function hasFullPart(part: string): boolean {
  const data = globalStore.get(part);
  if (!data?.toc) return false;
  const expected = data.toc.subparts.reduce((n, sp) => n + sp.sections.length, 0);
  return data.sections.size >= expected;
}

// ── FETCHING ────────────────────────────────────────────────────────────────

const inflightFetches = new Map<string, Promise<void>>();

async function fetchPartData(part: string, tocOnly = false): Promise<void> {
  const key = `${part}-${tocOnly ? "toc" : "full"}`;

  // Don't refetch if we already have what we need
  if (!tocOnly && hasFullPart(part)) return;
  if (tocOnly && getToc(part)) return;

  // Deduplicate in-flight requests
  if (inflightFetches.has(key)) return inflightFetches.get(key);

  const promise = (async () => {
    try {
      const url = tocOnly
        ? `/api/reader-data?part=${part}&toc=1`
        : `/api/reader-data?part=${part}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.toc) storePartToc(part, data.toc);
      if (data.sections?.length) storePartSections(part, data.sections);
    } catch {
      // Silent fail — data will be fetched on next attempt
    } finally {
      inflightFetches.delete(key);
    }
  })();

  inflightFetches.set(key, promise);
  return promise;
}

// ── COMPONENT ───────────────────────────────────────────────────────────────

interface Props {
  section: EcfrSection;
  toc: PartToc | null;
  adjacent: { prev: string | null; next: string | null };
  slug: string;
}

export function ReaderShell({ section: serverSection, toc: serverToc, adjacent: serverAdjacent, slug }: Props) {
  // ── Layout state ────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // ── Section state ───────────────────────────────────────────────────────
  const [currentSectionId, setCurrentSectionId] = useState(serverSection.section);
  // Revision counter to force re-renders when store updates
  const [storeRevision, setStoreRevision] = useState(0);

  const currentPart = currentSectionId.split(".")[0];

  // ── Seed store from server props ────────────────────────────────────────
  useEffect(() => {
    if (serverToc) storePartToc(serverToc.part, serverToc);
    storePartSections(serverSection.part, [serverSection]);
    setStoreRevision(r => r + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch full current part on mount / part change ──────────────────────
  useEffect(() => {
    fetchPartData(currentPart).then(() => setStoreRevision(r => r + 1));
  }, [currentPart]);

  // ── Derived data ────────────────────────────────────────────────────────
  const currentSection = useMemo(() => {
    void storeRevision; // dependency
    return getSection(currentSectionId) ?? serverSection;
  }, [currentSectionId, storeRevision, serverSection]);

  const currentToc = useMemo(() => {
    void storeRevision;
    return getToc(currentPart) ?? serverToc;
  }, [currentPart, storeRevision, serverToc]);

  const adjacent = useMemo(() => {
    void storeRevision;
    if (!currentToc) return serverAdjacent;
    const all = currentToc.subparts.flatMap(sp => sp.sections.map(s => s.section));
    const idx = all.indexOf(currentSectionId);
    return {
      prev: idx > 0 ? all[idx - 1] : null,
      next: idx < all.length - 1 ? all[idx + 1] : null,
    };
  }, [currentSectionId, currentToc, storeRevision, serverAdjacent]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const navigateTo = useCallback(async (sectionId: string) => {
    const part = sectionId.split(".")[0];

    // If section is already in store, instant switch
    const cached = getSection(sectionId);
    if (cached) {
      setCurrentSectionId(sectionId);
      window.history.pushState(null, "", `/regs/${sectionId}`);
      document.title = `§ ${cached.section} ${cached.title} | eRegs`;
      mainRef.current?.scrollTo(0, 0);
      return;
    }

    // If it's a different part, fetch it first
    await fetchPartData(part);
    setStoreRevision(r => r + 1);

    const nowCached = getSection(sectionId);
    if (nowCached) {
      setCurrentSectionId(sectionId);
      window.history.pushState(null, "", `/regs/${sectionId}`);
      document.title = `§ ${nowCached.section} ${nowCached.title} | eRegs`;
      mainRef.current?.scrollTo(0, 0);
      return;
    }

    // Absolute fallback: hard navigate (should never happen with full DB cache)
    window.location.href = `/regs/${sectionId}`;
  }, []);

  // ── Browser back/forward ────────────────────────────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/regs\/(.+)/);
      if (!match) return;
      const sectionId = match[1];
      const cached = getSection(sectionId);
      if (cached) {
        setCurrentSectionId(sectionId);
        mainRef.current?.scrollTo(0, 0);
      } else {
        // Different part not yet loaded — fetch then update
        const part = sectionId.split(".")[0];
        fetchPartData(part).then(() => {
          setStoreRevision(r => r + 1);
          setCurrentSectionId(sectionId);
          mainRef.current?.scrollTo(0, 0);
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── Fetch TOC for expanded sidebar parts ────────────────────────────────
  const fetchTocForPart = useCallback(async (part: string) => {
    if (getToc(part)) {
      setStoreRevision(r => r + 1);
      return;
    }
    await fetchPartData(part, true);
    setStoreRevision(r => r + 1);
  }, []);

  // ── Responsive ──────────────────────────────────────────────────────────
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

  // ── All TOCs for sidebar (derived from store) ───────────────────────────
  const allTocs = useMemo(() => {
    void storeRevision;
    const map = new Map<string, PartToc>();
    for (const [part, data] of globalStore) {
      if (data.toc) map.set(part, data.toc);
    }
    return map;
  }, [storeRevision]);

  // ── Render ──────────────────────────────────────────────────────────────
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
          allTocs={allTocs}
          currentSection={currentSectionId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
          onNavigate={navigateTo}
          onExpandPart={fetchTocForPart}
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
