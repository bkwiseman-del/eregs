"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NavRail } from "@/components/reader/NavRail";
import { ResizeHandle } from "@/components/reader/ResizeHandle";
import { BodyScrollLock } from "@/components/shared/BodyScrollLock";
import { AppNav } from "@/components/shared/AppNav";
import { MobileBottomTabs } from "@/components/shared/MobileBottomTabs";

const SIDEBAR_MIN = 240, SIDEBAR_MAX = 420, SIDEBAR_DEFAULT = 300;

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


// ── Types ────────────────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "VIDEO" | "PODCAST" | "ARTICLE";
  externalId: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  publisher: string;
  duration: string | null;
  durationSecs: number | null;
  audioUrl: string | null;
  episodeNum: number | null;
  publishedAt: string;
}

interface Activity {
  id: string;
  type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
  section: string;
  part: string;
  paragraphId?: string;
  sectionTitle?: string;
  textSnippet?: string;
  note?: string;
  createdAt: string;
}

type FilterType = "all" | "VIDEO" | "PODCAST" | "ARTICLE";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isNew(publishedAt: string): boolean {
  const d = new Date(publishedAt);
  const now = new Date();
  return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ item, onClose }: { item: FeedItem; onClose: () => void }) {
  const videoId = item.externalId;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 800, background: "var(--white)",
          borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "var(--text3)", flexShrink: 0, marginLeft: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Podcast Player Bar ───────────────────────────────────────────────────────

function PodcastPlayer({ item, onClose, onPlayingChange }: { item: FeedItem; onClose: () => void; onPlayingChange: (playing: boolean) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setPlaying(true);
      onPlayingChange(true);
    } else {
      audio.pause();
      setPlaying(false);
      onPlayingChange(false);
    }
  }, [onPlayingChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setPlaying(true);
      onPlayingChange(true);
    }).catch(() => {
      setPlaying(false);
      onPlayingChange(false);
    });

    const onTime = () => {
      if (!audio.duration) return;
      setProgress((audio.currentTime / audio.duration) * 100);
      const m = Math.floor(audio.currentTime / 60);
      const s = Math.floor(audio.currentTime % 60);
      setCurrentTime(`${m}:${String(s).padStart(2, "0")}`);
    };
    const onEnd = () => { setPlaying(false); onPlayingChange(false); setProgress(100); };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.pause();
    };
  }, [item.audioUrl, onPlayingChange]);

  // Listen for toggle events from the feed card play button
  useEffect(() => {
    const handler = () => togglePlayback();
    window.addEventListener("podcast-toggle", handler);
    return () => window.removeEventListener("podcast-toggle", handler);
  }, [togglePlayback]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "var(--rail-w)", right: 0,
      background: "var(--white)", borderTop: "1px solid var(--border)",
      padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
      zIndex: 100, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
    }}>
      <audio ref={audioRef} src={item.audioUrl ?? ""} preload="auto" />

      {/* Play/Pause */}
      <button onClick={togglePlayback} style={{
        width: 36, height: 36, borderRadius: "50%", background: "var(--accent)",
        border: "none", display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", cursor: "pointer", flexShrink: 0,
      }}>
        {playing ? (
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>

      {/* Info */}
      <div style={{ minWidth: 0, maxWidth: 300, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
          {item.publisher} · {currentTime} {item.duration ? `/ ${item.duration}` : ""}
        </div>
      </div>

      {/* Progress bar — fills remaining width */}
      <div onClick={seek} style={{
        flex: 1, height: 4, background: "var(--bg3)", borderRadius: 2,
        cursor: "pointer", minWidth: 80,
      }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", borderRadius: 2, transition: "width 0.3s" }} />
      </div>

      {/* Close */}
      <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "var(--text3)", flexShrink: 0 }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

// ── NEW Badge ────────────────────────────────────────────────────────────────

function NewBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <span style={{
      background: "var(--accent)", color: "white", fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 5, letterSpacing: "0.04em",
      ...style,
    }}>
      NEW
    </span>
  );
}

// ── Feed Cards ───────────────────────────────────────────────────────────────

const videoIcon = <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>;
const podcastIcon = <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>;
const articleIcon = <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

const thumbGradients = [
  "linear-gradient(135deg, #101e32, #1a4080)",
  "linear-gradient(135deg, #0a1e14, #0e5c30)",
  "linear-gradient(135deg, #1e1008, #8a3810)",
  "linear-gradient(135deg, #160d2e, #4a18a0)",
];

const fallbackIcons: Record<string, { bg: string; icon: React.ReactNode }> = {
  VIDEO: {
    bg: "linear-gradient(135deg, #101e32, #1a4080)",
    icon: <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  },
  PODCAST: {
    bg: "linear-gradient(135deg, #2e0d5e, #7c3aed)",
    icon: <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  },
  ARTICLE: {
    bg: "linear-gradient(135deg, #0a3020, #2a7d4f)",
    icon: <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
};

function FeedThumb({ item, overlay }: { item: FeedItem; overlay?: React.ReactNode }) {
  const [imgError, setImgError] = useState(false);
  const fb = fallbackIcons[item.type] ?? fallbackIcons.ARTICLE;
  const showFallback = !item.thumbnailUrl || imgError;

  return (
    <div style={{
      width: 120, height: 76, borderRadius: 8, flexShrink: 0, overflow: "hidden",
      background: showFallback ? fb.bg : "var(--bg2)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      {!showFallback && (
        <img
          src={item.thumbnailUrl ?? ""}
          alt=""
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
      {showFallback && fb.icon}
      {overlay}
    </div>
  );
}

function VideoFeedCard({ item, onPlay }: { item: FeedItem; onPlay: () => void }) {
  const itemIsNew = isNew(item.publishedAt);

  return (
    <div onClick={onPlay} style={{
      background: "var(--white)", border: "1px solid var(--border)", borderRadius: 13,
      marginBottom: 12, overflow: "hidden", cursor: "pointer", transition: "all .15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(201,106,42,.07)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
        <FeedThumb item={item} overlay={<>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(0,0,0,.35)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "white",
            }}>
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          {item.duration && (
            <div style={{
              position: "absolute", bottom: 4, right: 5,
              background: "rgba(0,0,0,.72)", color: "white", fontSize: 9,
              fontWeight: 600, padding: "1px 5px", borderRadius: 4,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {item.duration}
            </div>
          )}
        </>} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, color: "#1a6fc4" }}>
            {videoIcon} VIDEO · TRUCKSAFE
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 5 }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {item.description}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--text3)", display: "flex", alignItems: "center", gap: 7 }}>
            <span>{formatDate(item.publishedAt)}</span>
            {item.duration && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border2)" }} /><span>{item.duration}</span></>}
            {itemIsNew && <NewBadge style={{ marginLeft: 4 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function PodcastFeedCard({ item, onPlay, isPlaying }: { item: FeedItem; onPlay: () => void; isPlaying: boolean }) {
  const itemIsNew = isNew(item.publishedAt);
  return (
    <div style={{
      background: "var(--white)", border: "1px solid var(--border)", borderRadius: 13,
      marginBottom: 12, overflow: "hidden", cursor: "pointer", transition: "all .15s",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(201,106,42,.07)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
    onClick={onPlay}
    >
      <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
        <FeedThumb item={item} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, color: "#7c3aed" }}>
            {podcastIcon} PODCAST · TRUCKSAFE LIVE!{item.episodeNum ? ` · Ep. ${item.episodeNum}` : ""}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 5 }}>
            {item.title}
          </div>
          {item.description && (
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {item.description}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--text3)", display: "flex", alignItems: "center", gap: 7 }}>
            <span>{formatDate(item.publishedAt)}</span>
            {item.duration && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border2)" }} /><span>{item.duration}</span></>}
            {itemIsNew && <NewBadge style={{ marginLeft: 4 }} />}
          </div>
        </div>

        {/* Play/Pause button */}
        <button onClick={(e) => { e.stopPropagation(); onPlay(); }} style={{
          width: 40, height: 40, borderRadius: "50%", background: isPlaying ? "var(--text2)" : "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", flexShrink: 0, border: "none", cursor: "pointer",
          transition: "all .15s",
        }}>
          {isPlaying ? (
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ArticleFeedCard({ item }: { item: FeedItem }) {
  const itemIsNew = isNew(item.publishedAt);
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--white)", border: "1px solid var(--border)", borderRadius: 13,
        marginBottom: 12, overflow: "hidden", cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(201,106,42,.07)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
          <FeedThumb item={item} />

          {/* Body */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, color: "#2a7d4f" }}>
              {articleIcon} ARTICLE · TRUCKSAFE
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 5 }}>
              {item.title}
            </div>
            {item.description && (
              <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {item.description}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: "var(--text3)", display: "flex", alignItems: "center", gap: 7 }}>
              <span>{formatDate(item.publishedAt)}</span>
              {item.duration && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border2)" }} /><span>{item.duration}</span></>}
              {itemIsNew && <NewBadge style={{ marginLeft: 4 }} />}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8,
              fontSize: 11.5, fontWeight: 600, color: "var(--accent)",
              background: "var(--accent-bg)", border: "1px solid var(--accent-border)",
              padding: "4px 10px", borderRadius: 6,
            }}>
              Read article <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Activity Item ────────────────────────────────────────────────────────────

const actIcons: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  HIGHLIGHT: {
    bg: "rgba(253, 224, 71, 0.3)", border: "rgba(202, 172, 20, 0.3)", color: "#8a6a00",
    icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  NOTE: {
    bg: "var(--blue-bg)", border: "var(--blue-border)", color: "var(--blue)",
    icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  BOOKMARK: {
    bg: "var(--accent-bg)", border: "var(--accent-border)", color: "var(--accent)",
    icon: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  },
};

function ActivityItem({ activity }: { activity: Activity }) {
  const a = actIcons[activity.type] ?? actIcons.HIGHLIGHT;
  const label = activity.type === "HIGHLIGHT" ? "Highlighted" : activity.type === "NOTE" ? "Note on" : "Saved";
  const snippet = activity.note || activity.textSnippet;
  const href = activity.paragraphId
    ? `/regs/${activity.section}#${activity.paragraphId}`
    : `/regs/${activity.section}`;

  return (
    <a href={href} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", gap: 10, padding: "11px 0",
        borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "opacity .12s",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: a.bg, border: `1px solid ${a.border}`, color: a.color,
        }}>
          {a.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.45 }}>
            {label} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--accent)" }}>§ {activity.section}</span>
            <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: 6 }}>{relativeTime(activity.createdAt)}</span>
          </div>
          {activity.sectionTitle && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activity.sectionTitle}
            </div>
          )}
          {snippet && (
            <div style={{
              fontSize: 11.5, color: "var(--text3)", marginTop: 2, lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {activity.note ? `"${snippet}"` : snippet}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Filter Pills ─────────────────────────────────────────────────────────────

const filters: { label: string; value: FilterType; icon?: React.ReactNode }[] = [
  { label: "All", value: "all" },
  { label: "Videos", value: "VIDEO", icon: videoIcon },
  { label: "Podcast", value: "PODCAST", icon: podcastIcon },
  { label: "Articles", value: "ARTICLE", icon: articleIcon },
];

// ── Main Shell ───────────────────────────────────────────────────────────────

export function DashboardShell({ userName }: { userName: string }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<FilterType>("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<FeedItem | null>(null);
  const [playingPodcast, setPlayingPodcast] = useState<FeedItem | null>(null);
  const [podcastIsPlaying, setPodcastIsPlaying] = useState(false);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("eregs-dashboard-sidebar-w");
    if (saved) setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Number(saved))));
    if (localStorage.getItem("eregs-dashboard-sidebar-collapsed") === "1") setSidebarCollapsed(true);
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(w => {
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta));
      localStorage.setItem("eregs-dashboard-sidebar-w", String(next));
      return next;
    });
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(c => {
      localStorage.setItem("eregs-dashboard-sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  }, []);

  // Fetch feed
  const fetchFeed = useCallback(async (type: FilterType, offset = 0, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: "20", offset: String(offset) });
      if (type !== "all") params.set("type", type);
      const res = await fetch(`/api/dashboard/feed?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Feed API error:", res.status, err);
        return;
      }
      const data = await res.json();
      setItems(prev => append ? [...prev, ...data.items] : data.items);
      setTotal(data.total);
    } catch (e) {
      console.error("Feed error:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Fetch activity
  const fetchActivity = useCallback(async (offset = 0, append = false) => {
    if (append) setActivityLoading(true);
    try {
      const res = await fetch(`/api/dashboard/activity?limit=5&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      setActivity(prev => append ? [...prev, ...data.items] : data.items);
      setActivityTotal(data.total);
    } catch { /* silent */ } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Fetch on filter change
  useEffect(() => { fetchFeed(filter); }, [filter, fetchFeed]);

  const hasMore = items.length < total;

  return (
    <>
      <BodyScrollLock />
      <AppNav isMobile={isMobile} />

      <div style={{ display: "flex", height: "100vh", paddingTop: "var(--nav-h)", overflow: "hidden" }}>
      {/* NavRail — desktop only */}
      {!isMobile && <NavRail isPaid />}

      {/* Main Feed */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 0" }}>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Lora', serif" }}>From Trucksafe</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 3 }}>Latest videos, episodes, and articles from Trucksafe Consulting</div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, padding: "14px 24px 16px", overflowX: "auto" }}>
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 20,
                border: `1px solid ${filter === f.value ? "var(--accent-border)" : "var(--border)"}`,
                background: filter === f.value ? "var(--accent-bg)" : "var(--white)",
                fontSize: 12.5, fontWeight: 500,
                color: filter === f.value ? "var(--accent)" : "var(--text2)",
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                transition: "all .12s", fontFamily: "'Inter', sans-serif",
              }}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Feed items */}
        <div style={{ padding: "0 24px 40px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div style={{
                width: 24, height: 24, border: "2.5px solid var(--border)",
                borderTopColor: "var(--accent)", borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--text3)" }}>
              No content yet. Run the feed sync to populate.
            </div>
          ) : (
            <>
              {items.map(item => {
                if (item.type === "VIDEO") return <VideoFeedCard key={item.id} item={item} onPlay={() => setPlayingVideo(item)} />;
                if (item.type === "PODCAST") return <PodcastFeedCard key={item.id} item={item} isPlaying={playingPodcast?.id === item.id && podcastIsPlaying} onPlay={() => {
                  if (playingPodcast?.id === item.id) {
                    // Toggle pause/play on the current podcast
                    const event = new CustomEvent("podcast-toggle");
                    window.dispatchEvent(event);
                  } else {
                    setPlayingPodcast(item);
                  }
                }} />;
                return <ArticleFeedCard key={item.id} item={item} />;
              })}

              {hasMore && (
                <button
                  onClick={() => fetchFeed(filter, items.length, true)}
                  disabled={loadingMore}
                  style={{
                    width: "100%", padding: 11, background: "none",
                    border: "1px dashed var(--border2)", borderRadius: 9,
                    color: "var(--text3)", fontSize: 13, fontFamily: "'Inter', sans-serif",
                    cursor: "pointer", transition: "all .12s",
                  }}
                >
                  {loadingMore ? "Loading…" : "Load more from Trucksafe →"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Podcast player spacer */}
        {playingPodcast && <div style={{ height: 64 }} />}
      </main>

      {/* Resize handle for sidebar */}
      {!isMobile && !sidebarCollapsed && (
        <ResizeHandle
          side="right"
          onResize={handleSidebarResize}
          onDoubleClick={toggleSidebarCollapse}
        />
      )}

      {/* Collapsed sidebar tab */}
      {!isMobile && sidebarCollapsed && (
        <div
          onClick={toggleSidebarCollapse}
          title="Expand sidebar"
          className="dashboard-right-sidebar"
          style={{
            width: 28, flexShrink: 0, background: "var(--white)",
            borderLeft: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", writingMode: "vertical-rl",
            fontSize: 10, fontWeight: 600, color: "var(--text3)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          Activity
        </div>
      )}

      {/* Right Sidebar */}
      {!sidebarCollapsed && (
        <aside className="dashboard-right-sidebar" style={{
          width: sidebarWidth, flexShrink: 0, background: "var(--white)",
          borderLeft: "1px solid var(--border)", overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          {/* Greeting */}
          <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500, marginBottom: 3 }}>{greeting()}</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Lora', serif" }}>{userName}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 5, lineHeight: 1.5 }}>{todayDate()}</div>
          </div>

          {/* Recent Activity */}
          <div style={{ padding: "18px 18px 24px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 10 }}>
              Recent Activity
            </div>

            {activity.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
                No annotations yet. Start reading regulations and add highlights or notes to see your activity here.
              </div>
            ) : (
              <>
                {activity.map(a => <ActivityItem key={a.id} activity={a} />)}
                {activity.length < activityTotal && (
                  <button
                    onClick={() => fetchActivity(activity.length, true)}
                    disabled={activityLoading}
                    style={{
                      display: "block", width: "100%", padding: 11, background: "none",
                      border: "1px dashed var(--border2)", borderRadius: 9,
                      color: "var(--text3)", fontSize: 13, textAlign: "center",
                      cursor: "pointer", marginTop: 12, fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {activityLoading ? "Loading…" : "Show more activity"}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      {/* Modals */}
      {playingVideo && <VideoModal item={playingVideo} onClose={() => setPlayingVideo(null)} />}
      {playingPodcast && <PodcastPlayer item={playingPodcast} onClose={() => { setPlayingPodcast(null); setPodcastIsPlaying(false); }} onPlayingChange={setPodcastIsPlaying} />}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-right-sidebar { display: none !important; }
        }
      `}</style>
    </div>

    {/* Mobile bottom tabs */}
    {isMobile && <MobileBottomTabs isPaid />}
    </>
  );
}
