"use client";

import Link from "next/link";
import type { EcfrSection } from "@/lib/ecfr";
import { AppNav } from "@/components/shared/AppNav";

interface Props {
  section: EcfrSection;
  insightsOpen: boolean;
  onToggleInsights: () => void;
  onToggleSidebar: () => void;  // Mobile: open/close overlay
  onToggleToc?: () => void;     // Desktop: collapse/expand TOC
  tocCollapsed?: boolean;
  isMobile: boolean;
  isPaid?: boolean;
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

export function TopNav({ section, insightsOpen, onToggleInsights, onToggleSidebar, onToggleToc, tocCollapsed, isMobile, isPaid = false, onBookmark, isBookmarked = false }: Props) {
  const tocToggle = onToggleToc ? (
    <button onClick={onToggleToc} title={tocCollapsed ? "Show table of contents" : "Hide table of contents"} style={{
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
  ) : undefined;

  const mobileLocationPill = (
    <button onClick={onToggleSidebar} style={{
      flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6,
      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8,
      padding: "6px 10px", cursor: "pointer", overflow: "hidden"
    }}>
      <svg width="13" height="13" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
      <span style={{ fontSize: 12.5, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Pt. {section.part} › <strong style={{ color: "var(--text)", fontWeight: 500 }}>§ {section.section} {section.title}</strong>
      </span>
      <svg width="12" height="12" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  );

  const rightActions = (
    <>
      {/* Insights toggle — locked for free users */}
      {isPaid ? (
        <button onClick={onToggleInsights} title="Insights panel" style={{
          width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid", cursor: "pointer", flexShrink: 0,
          background: insightsOpen ? "var(--accent-bg)" : "var(--white)",
          borderColor: insightsOpen ? "var(--accent-border)" : "var(--border)",
          color: insightsOpen ? "var(--accent)" : "var(--text2)", transition: "all 0.15s"
        }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2z"/></svg>
        </button>
      ) : (
        <Link href="/insights" title="Insights (Pro)" style={{ textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0,
            background: "var(--white)", color: "var(--text3)", transition: "all 0.15s",
            position: "relative", opacity: 0.5,
          }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2z"/></svg>
            <svg width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" style={{ position: "absolute", top: 3, right: 3 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </Link>
      )}

      {/* Bookmark — paid only */}
      {isPaid && (
        <button onClick={onBookmark} title={isBookmarked ? "Remove bookmark" : "Bookmark this section"} style={{
          width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid", cursor: "pointer", flexShrink: 0,
          background: isBookmarked ? "var(--accent-bg)" : "var(--white)",
          borderColor: isBookmarked ? "var(--accent-border)" : "var(--border)",
          color: isBookmarked ? "var(--accent)" : "var(--text2)", transition: "all 0.15s"
        }}>
          <svg width="14" height="14" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>
      )}
    </>
  );

  return (
    <AppNav
      isMobile={isMobile}
      leftAction={!isMobile ? tocToggle : undefined}
      mobileCenter={isMobile ? mobileLocationPill : undefined}
      rightActions={rightActions}
    />
  );
}
