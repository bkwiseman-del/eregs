"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { EcfrSection, PartToc } from "@/lib/ecfr";
import type { Annotation } from "@/lib/annotations";
import { makeParagraphId } from "@/lib/annotations";
import { TopNav } from "./TopNav";
import { NavRail } from "./NavRail";
import { ReaderSidebar } from "./ReaderSidebar";
import { ReaderContent } from "./ReaderContent";
import { InsightsPanel } from "./InsightsPanel";
import { ActionBar } from "./ActionBar";
import { NoteSheet } from "./NoteSheet";
import { Toast } from "./Toast";

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

  // ── ANNOTATIONS ─────────────────────────────────────────────────────────

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Annotation | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastKey, setToastKey] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastKey(k => k + 1);
  }, []);

  // Fetch annotations when section changes
  useEffect(() => {
    fetch(`/api/annotations?section=${currentSectionId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setAnnotations)
      .catch(() => setAnnotations([]));
  }, [currentSectionId]);

  // Clear selection when navigating
  useEffect(() => {
    setSelectedPids(new Set());
  }, [currentSectionId]);

  const togglePara = useCallback((pid: string) => {
    setSelectedPids(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPids(new Set());
  }, []);

  // Check if all selected paragraphs are highlighted
  const allSelectedHighlighted = useMemo(() => {
    if (selectedPids.size === 0) return false;
    return [...selectedPids].every(pid =>
      annotations.some(a => a.paragraphId === pid && a.type === "HIGHLIGHT")
    );
  }, [selectedPids, annotations]);

  // Highlight / Remove Highlight
  const handleHighlight = useCallback(async () => {
    const pids = [...selectedPids];
    for (const pid of pids) {
      try {
        const res = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "HIGHLIGHT",
            paragraphId: pid,
            part: currentPart,
            section: currentSectionId,
            regVersion: "",
          }),
        });
        const data = await res.json();
        if (data.deleted) {
          setAnnotations(prev => prev.filter(a => a.id !== data.id));
        } else {
          setAnnotations(prev => [...prev, data]);
        }
      } catch { /* silent */ }
    }
    const msg = allSelectedHighlighted
      ? "Highlight removed"
      : `${pids.length === 1 ? "1 paragraph" : `${pids.length} paragraphs`} highlighted`;
    showToast(msg);
    clearSelection();
  }, [selectedPids, currentPart, currentSectionId, allSelectedHighlighted, showToast, clearSelection]);

  // Open note sheet
  const handleOpenNote = useCallback(() => {
    setEditingNote(null);
    setNoteSheetOpen(true);
  }, []);

  // Edit existing note
  const handleEditNote = useCallback((annotation: Annotation) => {
    setEditingNote(annotation);
    setNoteSheetOpen(true);
  }, []);

  // Save note
  const handleSaveNote = useCallback(async (text: string) => {
    if (editingNote) {
      // Update existing
      try {
        const res = await fetch("/api/annotations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingNote.id, note: text }),
        });
        const updated = await res.json();
        setAnnotations(prev => prev.map(a => a.id === updated.id ? updated : a));
        showToast("Note updated");
      } catch { /* silent */ }
    } else {
      // Create new note for each selected paragraph
      const pids = [...selectedPids];
      for (const pid of pids) {
        try {
          const res = await fetch("/api/annotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "NOTE",
              paragraphId: pid,
              part: currentPart,
              section: currentSectionId,
              note: text,
              regVersion: "",
            }),
          });
          const data = await res.json();
          if (!data.deleted) setAnnotations(prev => [...prev, data]);
        } catch { /* silent */ }
      }
      showToast("Note saved");
      clearSelection();
    }
    setNoteSheetOpen(false);
    setEditingNote(null);
  }, [editingNote, selectedPids, currentPart, currentSectionId, showToast, clearSelection]);

  // Delete note
  const handleDeleteNote = useCallback(async () => {
    if (!editingNote) return;
    try {
      await fetch(`/api/annotations?id=${editingNote.id}`, { method: "DELETE" });
      setAnnotations(prev => prev.filter(a => a.id !== editingNote.id));
      showToast("Note deleted");
    } catch { /* silent */ }
    setNoteSheetOpen(false);
    setEditingNote(null);
  }, [editingNote, showToast]);

  // Copy with citation
  const handleCopy = useCallback(() => {
    const pids = [...selectedPids];
    const blocks = pids.map(pid => {
      const node = currentSection.content.find((n, i) =>
        makeParagraphId(currentSectionId, n.label, i) === pid
      );
      if (!node) return "";
      const label = node.label ? `(${node.label}) ` : "";
      return `${label}${node.text}`;
    }).filter(Boolean);

    const text = blocks.join("\n\n");
    const citation = `49 CFR § ${currentSectionId} — via eRegs (eregs.app/regs/${currentSectionId})`;
    const output = `${text}\n\n${citation}`;

    navigator.clipboard?.writeText(output).catch(() => {});
    showToast("Copied with citation");
    clearSelection();
  }, [selectedPids, currentSection, currentSectionId, showToast, clearSelection]);

  // Build paragraph preview for note sheet
  const noteSheetPreview = useMemo(() => {
    if (editingNote) {
      const node = currentSection.content.find((n, i) =>
        makeParagraphId(currentSectionId, n.label, i) === editingNote.paragraphId
      );
      return node ? `${node.label ? `(${node.label}) ` : ""}${node.text.slice(0, 80)}…` : "";
    }
    const pids = [...selectedPids];
    return pids.map(pid => {
      const node = currentSection.content.find((n, i) =>
        makeParagraphId(currentSectionId, n.label, i) === pid
      );
      if (!node) return "";
      const label = node.label ? `(${node.label}) — ` : "";
      return label + node.text.slice(0, 60) + (node.text.length > 60 ? "…" : "");
    }).join(" | ");
  }, [selectedPids, editingNote, currentSection, currentSectionId]);

  // Click outside to clear selection
  const handleMainClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-para]") &&
        !target.closest(".action-bar") &&
        !target.closest(".note-bubble")) {
      // Only clear if clicking on the main background, not on paragraphs
    }
  }, []);

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
          <ReaderContent
            section={currentSection}
            adjacent={adjacent}
            onNavigate={navigateTo}
            annotations={annotations}
            selectedPids={selectedPids}
            onTogglePara={togglePara}
            onEditNote={handleEditNote}
          />
        </main>

        <InsightsPanel
          section={currentSection}
          open={insightsOpen}
          onClose={() => setInsightsOpen(false)}
        />
      </div>

      {/* Annotation UI overlays */}
      <ActionBar
        selectedCount={selectedPids.size}
        allHighlighted={allSelectedHighlighted}
        onHighlight={handleHighlight}
        onNote={handleOpenNote}
        onCopy={handleCopy}
        onClear={clearSelection}
      />

      <NoteSheet
        open={noteSheetOpen}
        onClose={() => { setNoteSheetOpen(false); setEditingNote(null); }}
        onSave={handleSaveNote}
        onDelete={editingNote ? handleDeleteNote : undefined}
        paragraphPreview={noteSheetPreview}
        initialText={editingNote?.note || ""}
        isEditing={!!editingNote}
      />

      <Toast message={toastMsg} visible={toastKey > 0} key={toastKey} />
    </div>
  );
}
