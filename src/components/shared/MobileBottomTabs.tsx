"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ── More Menu ───────────────────────────────────────────────────────────────

function MoreMenu({ onClose, isPaid }: { onClose: () => void; isPaid: boolean }) {
  const pathname = usePathname();

  const menuItems = [
    ...(isPaid ? [{ label: "Fleet Dashboard", href: "/fleet", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 4v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }] : []),
    { label: "Settings", href: "#", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} />

      {/* Sheet */}
      <div style={{
        background: "var(--white)", borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: "8px 0", paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "4px auto 12px" }} />

        {menuItems.map(item => (
          <Link key={item.label} href={item.href} onClick={onClose} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
            textDecoration: "none", color: pathname === item.href ? "var(--accent)" : "var(--text)",
            fontSize: 15, fontWeight: 500,
          }}>
            <div style={{ color: pathname === item.href ? "var(--accent)" : "var(--text3)" }}>{item.icon}</div>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Bottom Tabs ─────────────────────────────────────────────────────────────

const libraryPaths = ["/notes", "/highlights", "/saved"];

export function MobileBottomTabs({ isPaid = false }: { isPaid?: boolean }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = [
    {
      label: "Dashboard",
      action: "/dashboard" as const,
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      active: pathname === "/dashboard",
      proOnly: true,
    },
    {
      label: "Regs",
      action: "/regs/390.1" as const,
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
      active: pathname.startsWith("/regs"),
      proOnly: false,
    },
    {
      label: "Search",
      action: "/search" as const,
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
      active: pathname === "/search",
      proOnly: false,
    },
    {
      label: "Library",
      action: "/notes" as const,
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
      active: libraryPaths.includes(pathname),
      proOnly: true,
    },
    {
      label: "More",
      action: "more" as const,
      icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
      active: moreOpen,
      proOnly: false,
    },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 54,
        background: "var(--white)", borderTop: "1px solid var(--border)",
        display: "flex", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {tabs.map(tab => {
          const locked = tab.proOnly && !isPaid;

          const handleClick = (e: React.MouseEvent) => {
            if (tab.action === "more") {
              e.preventDefault();
              setMoreOpen(!moreOpen);
            }
          };

          const isLink = tab.action !== "more";

          const content = (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3,
              position: "relative",
              color: locked ? "var(--border2)" : tab.active ? "var(--accent)" : "var(--text3)",
              opacity: locked ? 0.55 : 1,
              fontSize: 10, fontWeight: 500, letterSpacing: "0.02em",
              cursor: "pointer",
            }}>
              {tab.icon}
              {tab.label}
            </div>
          );

          if (isLink) {
            return (
              <Link key={tab.label} href={tab.action} style={{
                flex: 1, display: "flex", textDecoration: "none",
              }}>
                {content}
              </Link>
            );
          }

          return (
            <button key={tab.label} onClick={handleClick} style={{
              flex: 1, display: "flex", border: "none", background: "transparent", padding: 0,
            }}>
              {content}
            </button>
          );
        })}
      </nav>

      {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} isPaid={isPaid} />}
    </>
  );
}
