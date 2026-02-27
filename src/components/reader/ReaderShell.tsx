"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { EcfrSection, PartToc } from "@/lib/ecfr";
import type { ReaderAnnotation } from "@/lib/annotations";
import { makeParagraphId } from "@/lib/annotations";
import { TopNav } from "./TopNav";
import { NavRail } from "./NavRail";
import { ReaderSidebar } from "./ReaderSidebar";
import { ReaderContent } from "./ReaderContent";
import { InsightsPanel } from "./InsightsPanel";
import { ActionBar } from "./ActionBar";
import { ResizeHandle } from "./ResizeHandle";
import { Toast } from "./Toast";
import { ProBanner } from "./ProBanner";
import { MobileBottomTabs } from "@/components/shared/MobileBottomTabs";

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
  const part = sectionId.includes("-app") ? sectionId.split("-")[0] : sectionId.split(".")[0];
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

  // ── Resizable panel widths (desktop only) ──────────────────────────────
  const TOC_MIN = 200, TOC_MAX = 420, TOC_DEFAULT = 290;
  const INS_MIN = 240, INS_MAX = 440, INS_DEFAULT = 296;
  const [tocWidth, setTocWidth] = useState(TOC_DEFAULT);
  const [insWidth, setInsWidth] = useState(INS_DEFAULT);
  // Track collapsed state separately from open state for desktop
  const [tocCollapsed, setTocCollapsed] = useState(false);

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

  const handleInsResize = useCallback((delta: number) => {
    setInsWidth(w => Math.min(INS_MAX, Math.max(INS_MIN, w + delta)));
  }, []);

  const toggleTocCollapse = useCallback(() => {
    setTocCollapsed(c => {
      localStorage.setItem("eregs-toc-collapsed", c ? "0" : "1");
      return !c;
    });
  }, []);

  // ── Section state ───────────────────────────────────────────────────────
  const [currentSectionId, setCurrentSectionId] = useState(serverSection.section);
  // Revision counter to force re-renders when store updates
  const [storeRevision, setStoreRevision] = useState(0);

  const currentPart = currentSectionId.includes("-app")
    ? currentSectionId.split("-")[0]
    : currentSectionId.split(".")[0];

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

  // ── Scroll to hash target ──────────────────────────────────────────────
  const scrollToHash = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || !mainRef.current) return;
    // Small delay to let React render the content
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight pulse
      const inner = el.firstElementChild as HTMLElement | null;
      if (inner) {
        inner.style.transition = "box-shadow 0.3s";
        inner.style.boxShadow = "0 0 0 3px var(--accent-border)";
        setTimeout(() => { inner.style.boxShadow = "none"; }, 2000);
      }
    });
  }, []);

  // Scroll to hash on initial mount (direct URL visit with fragment)
  useEffect(() => {
    scrollToHash();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ──────────────────────────────────────────────────────────
  const navigateTo = useCallback(async (sectionId: string) => {
    const part = sectionId.includes("-app")
      ? sectionId.split("-")[0]
      : sectionId.split(".")[0];

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
      const hash = window.location.hash;
      const cached = getSection(sectionId);
      if (cached) {
        setCurrentSectionId(sectionId);
        if (hash) scrollToHash(); else mainRef.current?.scrollTo(0, 0);
      } else {
        // Different part not yet loaded — fetch then update
        const part = sectionId.split(".")[0];
        fetchPartData(part).then(() => {
          setStoreRevision(r => r + 1);
          setCurrentSectionId(sectionId);
          if (hash) scrollToHash(); else mainRef.current?.scrollTo(0, 0);
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

  // ── HISTORICAL VERSION BROWSING (Pro) ───────────────────────────────────

  const [historicalDate, setHistoricalDate] = useState<string | null>(null);
  const [historicalSection, setHistoricalSection] = useState<EcfrSection | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  // Fetch historical version when date changes
  useEffect(() => {
    if (!historicalDate) {
      setHistoricalSection(null);
      return;
    }
    let cancelled = false;
    setHistoricalLoading(true);
    fetch(`/api/historical-section?section=${currentSectionId}&date=${historicalDate}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setHistoricalSection({
            part: data.part,
            section: data.section,
            title: data.title,
            content: data.content,
            subpartLabel: data.subpartLabel,
            subpartTitle: data.subpartTitle,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          showToast("Could not load regulations for that date");
          setHistoricalDate(null);
          setHistoricalSection(null);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoricalLoading(false);
      });
    return () => { cancelled = true; };
  }, [historicalDate, currentSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear historical mode on navigation
  useEffect(() => {
    setHistoricalDate(null);
    setHistoricalSection(null);
    setDiffMode(false);
  }, [currentSectionId]);

  // The section to display: historical if viewing past date, otherwise current
  const displaySection = historicalDate && historicalSection ? historicalSection : currentSection;

  // ── DIFF MODE ──────────────────────────────────────────────────────────────

  const [diffMode, setDiffMode] = useState(false);

  // Clear diff mode when historical date changes
  useEffect(() => {
    setDiffMode(false);
  }, [historicalDate]);

  // ── ANNOTATIONS ─────────────────────────────────────────────────────────

  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [selectedPids, setSelectedPids] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<ReaderAnnotation | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const localIdCounter = useRef(0);
  const { status: sessionStatus } = useSession();
  const isPaid = sessionStatus === "authenticated";
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null); // null = unknown yet

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastKey(k => k + 1);
  }, []);

  const makeLocalId = () => `local-${++localIdCounter.current}-${Date.now()}`;

  // Replace a local ID with the real server ID in state
  const reconcileId = useCallback((localId: string, serverId: string) => {
    setAnnotations(prev => prev.map(a =>
      a.id === localId ? { ...a, id: serverId } : a
    ));
    // Also update editingNote if it's the one being reconciled
    setEditingNote(prev =>
      prev && prev.id === localId ? { ...prev, id: serverId } : prev
    );
  }, []);

  // Sync a local annotation to the server, reconcile ID on success
  const syncToServer = useCallback(async (
    localId: string,
    body: Record<string, unknown>,
  ) => {
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id && data.id !== localId) {
          reconcileId(localId, data.id);
        }
        setIsAuthed(true);
      } else if (res.status === 401) {
        setIsAuthed(false);
      }
    } catch {
      // Offline or network error — annotation stays local
    }
  }, [reconcileId]);

  // Fetch annotations from API on section change; merge with any unsynced local annotations
  useEffect(() => {
    const localAnnotations = annotations.filter(
      a => a.id.startsWith("local-") && a.section === currentSectionId
    );

    fetch(`/api/annotations?section=${currentSectionId}`)
      .then(r => {
        if (!r.ok) throw new Error("not authed");
        return r.json();
      })
      .then((serverAnnotations: ReaderAnnotation[]) => {
        setIsAuthed(true);
        // Dedup by ID — local annotations not yet on server keep their local- prefix
        const serverIds = new Set(serverAnnotations.map(a => a.id));
        const unsyncedLocal = localAnnotations.filter(a => !serverIds.has(a.id));
        setAnnotations([...serverAnnotations, ...unsyncedLocal]);

        for (const local of unsyncedLocal) {
          const body: Record<string, unknown> = {
            type: local.type, part: local.part, section: local.section,
          };
          if (local.type === "NOTE" || local.type === "HIGHLIGHT") {
            body.paragraphIds = local.paragraphIds || [local.paragraphId];
            if (local.type === "NOTE") body.note = local.note;
          } else {
            body.paragraphId = local.paragraphId;
          }
          syncToServer(local.id, body);
        }
      })
      .catch(() => {
        setIsAuthed(false);
        setAnnotations(prev => prev.filter(
          a => a.id.startsWith("local-") || a.section === currentSectionId
        ));
      });
  }, [currentSectionId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Check if current section is bookmarked
  const isBookmarked = useMemo(() => {
    return annotations.some(a => a.type === "BOOKMARK" && a.section === currentSectionId);
  }, [annotations, currentSectionId]);

  // Toggle bookmark for current section
  const handleBookmark = useCallback(async () => {
    if (isBookmarked) {
      const bookmark = annotations.find(a => a.type === "BOOKMARK" && a.section === currentSectionId);
      if (!bookmark) return;
      setAnnotations(prev => prev.filter(a => a.id !== bookmark.id));
      showToast("Bookmark removed");
      if (!bookmark.id.startsWith("local-")) {
        fetch(`/api/annotations?id=${bookmark.id}&type=BOOKMARK`, { method: "DELETE" }).catch(() => {});
      }
    } else {
      const localId = makeLocalId();
      const newBookmark: ReaderAnnotation = {
        id: localId,
        type: "BOOKMARK",
        paragraphId: `${currentSectionId}-p0`,
        part: currentPart,
        section: currentSectionId,
        createdAt: new Date().toISOString(),
      };
      setAnnotations(prev => [...prev, newBookmark]);
      showToast("Section bookmarked");
      syncToServer(localId, {
        type: "BOOKMARK",
        paragraphId: `${currentSectionId}-p0`,
        part: currentPart,
        section: currentSectionId,
      });
    }
  }, [isBookmarked, annotations, currentSectionId, currentPart, showToast, syncToServer]);

  // Check if all selected paragraphs are highlighted
  const allSelectedHighlighted = useMemo(() => {
    if (selectedPids.size === 0) return false;
    return [...selectedPids].every(pid =>
      annotations.some(a => a.type === "HIGHLIGHT" && (a.paragraphIds?.includes(pid) || a.paragraphId === pid))
    );
  }, [selectedPids, annotations]);

  // Highlight / Remove Highlight — local state first, reconcile with API
  const handleHighlight = useCallback(async () => {
    const pids = [...selectedPids];
    const removing = allSelectedHighlighted;

    if (removing) {
      // Find all highlight rows that overlap with selected pids, remove entire rows
      const toRemove = annotations.filter(a =>
        a.type === "HIGHLIGHT" &&
        pids.some(pid => a.paragraphIds?.includes(pid) || a.paragraphId === pid)
      );
      const removeIds = new Set(toRemove.map(a => a.id));
      setAnnotations(prev => prev.filter(a => !removeIds.has(a.id)));

      for (const anno of toRemove) {
        if (!anno.id.startsWith("local-")) {
          fetch(`/api/annotations?id=${anno.id}&type=HIGHLIGHT`, { method: "DELETE" }).catch(() => {});
        }
      }
    } else {
      // Create ONE highlight with all selected paragraph IDs (sorted by document order)
      const sortedPids = pids.sort((a, b) => {
        const idxA = currentSection.content.findIndex((n, i) =>
          makeParagraphId(currentSectionId, n.label, i) === a
        );
        const idxB = currentSection.content.findIndex((n, i) =>
          makeParagraphId(currentSectionId, n.label, i) === b
        );
        return idxA - idxB;
      });

      const localId = makeLocalId();
      const newHighlight: ReaderAnnotation = {
        id: localId,
        type: "HIGHLIGHT",
        paragraphId: sortedPids[sortedPids.length - 1],
        paragraphIds: sortedPids,
        part: currentPart,
        section: currentSectionId,
        createdAt: new Date().toISOString(),
      };
      setAnnotations(prev => [...prev, newHighlight]);

      syncToServer(localId, {
        type: "HIGHLIGHT", paragraphIds: sortedPids,
        part: currentPart, section: currentSectionId,
      });
    }

    const msg = removing
      ? "Highlight removed"
      : `${pids.length === 1 ? "1 paragraph" : `${pids.length} paragraphs`} highlighted`;
    showToast(msg);
    clearSelection();
  }, [selectedPids, currentPart, currentSectionId, currentSection, allSelectedHighlighted, annotations, showToast, clearSelection, syncToServer]);

  // Edit existing note — opens inline in ActionBar
  const handleEditNote = useCallback((annotation: ReaderAnnotation) => {
    setEditingNote(annotation);
  }, []);

  // Save note — local state first, reconcile with API
  const handleSaveNote = useCallback(async (text: string) => {
    if (editingNote) {
      // Update existing — local first
      setAnnotations(prev => prev.map(a =>
        a.id === editingNote.id ? { ...a, note: text, updatedAt: new Date().toISOString() } : a
      ));
      showToast("Note updated");

      if (editingNote.id.startsWith("local-")) {
        syncToServer(editingNote.id, {
          type: "NOTE",
          paragraphIds: editingNote.paragraphIds || [editingNote.paragraphId],
          part: editingNote.part, section: editingNote.section,
          note: text,
        });
      } else {
        fetch("/api/annotations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingNote.id, note: text }),
        }).catch(() => {});
      }
    } else {
      // Create one Note with all selected paragraph IDs (sorted by document order)
      const pids = [...selectedPids].sort((a, b) => {
        const idxA = currentSection.content.findIndex((n, i) =>
          makeParagraphId(currentSectionId, n.label, i) === a
        );
        const idxB = currentSection.content.findIndex((n, i) =>
          makeParagraphId(currentSectionId, n.label, i) === b
        );
        return idxA - idxB;
      });

      const newNote: ReaderAnnotation = {
        id: makeLocalId(),
        type: "NOTE",
        paragraphId: pids[pids.length - 1],  // bubble placement
        paragraphIds: pids,
        part: currentPart,
        section: currentSectionId,
        note: text,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAnnotations(prev => [...prev, newNote]);
      showToast("Note saved");
      clearSelection();

      syncToServer(newNote.id, {
        type: "NOTE", paragraphIds: pids,
        part: currentPart, section: currentSectionId, note: text,
      });
    }
    setEditingNote(null);
  }, [editingNote, selectedPids, currentPart, currentSectionId, currentSection, showToast, clearSelection, syncToServer]);

  // Delete note — single note row now covers all paragraphs
  const handleDeleteNote = useCallback(async () => {
    if (!editingNote) return;

    setAnnotations(prev => prev.filter(a => a.id !== editingNote.id));
    showToast("Note deleted");

    if (!editingNote.id.startsWith("local-")) {
      fetch(`/api/annotations?id=${editingNote.id}&type=NOTE`, { method: "DELETE" }).catch(() => {});
    }

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

  // Count impacted annotations in current section
  const impactedCount = useMemo(() => {
    return annotations.filter(a => a.impactedByChange).length;
  }, [annotations]);

  // Dismiss impact warnings for current section
  const handleDismissImpact = useCallback(async () => {
    const impacted = annotations.filter(a => a.impactedByChange);
    // Optimistic: clear locally
    setAnnotations(prev => prev.map(a =>
      a.impactedByChange ? { ...a, impactedByChange: false } : a
    ));
    showToast("Warnings dismissed");
    // Persist to server for each annotation
    for (const a of impacted) {
      if (a.id.startsWith("local-")) continue;
      fetch("/api/annotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, dismissImpact: true }),
      }).catch(() => {});
    }
  }, [annotations, showToast]);

  // Keep a single impacted annotation (dismiss its warning)
  const handleKeepAnnotation = useCallback(async (id: string) => {
    setAnnotations(prev => prev.map(a =>
      a.id === id ? { ...a, impactedByChange: false } : a
    ));
    if (!id.startsWith("local-")) {
      fetch("/api/annotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dismissImpact: true }),
      }).catch(() => {});
    }
  }, []);

  // Delete a single annotation
  const handleDeleteAnnotation = useCallback(async (id: string, type: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
    if (!id.startsWith("local-")) {
      fetch(`/api/annotations?id=${id}&type=${type}`, { method: "DELETE" }).catch(() => {});
    }
  }, [editingNote]);

  const handleMainClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-para]") &&
        !target.closest(".action-bar") &&
        !target.closest(".note-bubble")) {
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
        onToggleToc={!isMobile ? toggleTocCollapse : undefined}
        tocCollapsed={tocCollapsed}
        isMobile={isMobile}
        isPaid={isPaid}
        onBookmark={handleBookmark}
        isBookmarked={isBookmarked}
      />

      <div style={{
        position: "fixed",
        top: "var(--nav-h)", bottom: isMobile ? 54 : 0, left: 0, right: 0,
        display: "flex", overflow: "hidden"
      }}>
        {!isMobile && <NavRail isPaid={isPaid} currentSection={currentSectionId} />}

        {/* Desktop TOC with resize handle */}
        {!isMobile && !tocCollapsed && (
          <>
            <ReaderSidebar
              allTocs={allTocs}
              currentSection={currentSectionId}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              isMobile={false}
              onNavigate={navigateTo}
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

        {/* Desktop collapsed TOC tab */}
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

        {/* Mobile TOC (overlay) */}
        {isMobile && (
          <ReaderSidebar
            allTocs={allTocs}
            currentSection={currentSectionId}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isMobile={true}
            onNavigate={navigateTo}
            onExpandPart={fetchTocForPart}
          />
        )}

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
          {!isPaid && <ProBanner />}
          <ReaderContent
            section={displaySection}
            currentSectionContent={currentSection.content}
            adjacent={historicalDate ? { prev: null, next: null } : adjacent}
            onNavigate={navigateTo}
            annotations={historicalDate ? [] : annotations}
            impactedAnnotations={annotations.filter(a => a.impactedByChange)}
            selectedPids={historicalDate ? new Set() : selectedPids}
            onTogglePara={togglePara}
            onEditNote={handleEditNote}
            historicalDate={historicalDate}
            historicalLoading={historicalLoading}
            onSelectHistoricalDate={isPaid ? setHistoricalDate : undefined}
            diffMode={diffMode}
            onToggleDiff={() => setDiffMode(v => !v)}
            isPro={isPaid}
            impactedAnnotationCount={impactedCount}
            onDismissImpact={handleDismissImpact}
            onKeepAnnotation={handleKeepAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
          />
        </main>

        {/* Desktop insights with resize handle — Pro only */}
        {isPaid && !isMobile && insightsOpen && (
          <ResizeHandle
            side="right"
            onResize={handleInsResize}
          />
        )}

        {isPaid && (
          <InsightsPanel
            section={currentSection}
            open={insightsOpen}
            onClose={() => setInsightsOpen(false)}
            width={insWidth}
          />
        )}
      </div>

      {/* Mobile bottom tabs */}
      {isMobile && <MobileBottomTabs isPaid={isPaid} />}

      {/* Annotation UI */}
      <ActionBar
        selectedCount={selectedPids.size}
        allHighlighted={allSelectedHighlighted}
        onHighlight={handleHighlight}
        onSaveNote={handleSaveNote}
        onCopy={handleCopy}
        onClear={clearSelection}
        editingNote={editingNote ? { id: editingNote.id, note: editingNote.note || "" } : null}
        onUpdateNote={(text) => handleSaveNote(text)}
        onDeleteNote={handleDeleteNote}
        onCancelEdit={() => setEditingNote(null)}
        paragraphPreview={noteSheetPreview}
        isPaid={isPaid}
      />

      <Toast message={toastMsg} visible={toastKey > 0} key={toastKey} />
    </div>
  );
}
