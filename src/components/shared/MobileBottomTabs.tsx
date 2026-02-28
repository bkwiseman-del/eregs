"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

// ── More Menu ───────────────────────────────────────────────────────────────

function MoreMenu({ onClose, isPaid }: { onClose: () => void; isPaid: boolean }) {
  const pathname = usePathname();
  const { canPrompt, isIOS, installed, promptInstall } = useInstallPrompt();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const showInstall = !installed && (canPrompt || isIOS);

  const menuItems = [
    ...(isPaid ? [{ label: "Fleet Dashboard", href: "/fleet", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 4v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }] : []),
    { label: "Download for Offline", href: "#offline", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> },
    { label: "Settings", href: "#", icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ];

  const handleItemClick = (href: string) => {
    if (href === "#offline") {
      onClose();
      window.dispatchEvent(new CustomEvent("open-download-dialog"));
      return;
    }
    onClose();
  };

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

        {menuItems.map(item => {
          if (item.href.startsWith("#")) {
            return (
              <button key={item.label} onClick={() => handleItemClick(item.href)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                background: "none", border: "none", width: "100%", textAlign: "left",
                color: "var(--text)", fontSize: 15, fontWeight: 500, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>
                <div style={{ color: "var(--text3)" }}>{item.icon}</div>
                {item.label}
              </button>
            );
          }
          return (
            <Link key={item.label} href={item.href} onClick={onClose} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
              textDecoration: "none", color: pathname === item.href ? "var(--accent)" : "var(--text)",
              fontSize: 15, fontWeight: 500,
            }}>
              <div style={{ color: pathname === item.href ? "var(--accent)" : "var(--text3)" }}>{item.icon}</div>
              {item.label}
            </Link>
          );
        })}

        {/* Install App option */}
        {showInstall && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "4px 20px" }} />
            <button
              onClick={() => {
                if (canPrompt) {
                  promptInstall();
                  onClose();
                } else if (isIOS) {
                  setShowIOSGuide(true);
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                background: "none", border: "none", width: "100%", textAlign: "left",
                color: "var(--accent)", fontSize: 15, fontWeight: 500, cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <div style={{ color: "var(--accent)" }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M12 2l3 3m-3-3l-3 3m3-3v12" />
                  <path d="M5 10v9a2 2 0 002 2h10a2 2 0 002-2v-9" />
                </svg>
              </div>
              Install App
            </button>
          </>
        )}
      </div>

      {/* iOS instructions */}
      {showIOSGuide && <IOSInstallGuideSheet onClose={() => { setShowIOSGuide(false); onClose(); }} />}
    </div>
  );
}

function IOSInstallGuideSheet({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        background: "var(--white)", borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: "24px 20px", paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        fontFamily: "'Inter', sans-serif",
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16, color: "var(--text, #1a1814)" }}>
          Install eRegs
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { n: 1, text: "Tap the Share button in Safari", color: "#007AFF", d: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v12" },
            { n: 2, text: "Scroll down and tap \"Add to Home Screen\"", color: "#007AFF", d: "M3 3h18v18H3zM12 8v8M8 12h8" },
            { n: 3, text: "Tap \"Add\" in the top right", color: "#34C759", d: "M20 6L9 17l-5-5" },
          ].map(step => (
            <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg2, #f3f1ee)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" fill="none" stroke={step.color} strokeWidth="1.8" viewBox="0 0 24 24"><path d={step.d} /></svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", marginBottom: 1 }}>Step {step.n}</div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{step.text}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{
          width: "100%", marginTop: 20, padding: "12px 0", fontSize: 14, fontWeight: 600,
          background: "var(--bg2, #f3f1ee)", border: "1px solid var(--border, #e5e1db)",
          borderRadius: 10, cursor: "pointer", color: "var(--text, #1a1814)", fontFamily: "'Inter', sans-serif",
        }}>
          Got it
        </button>
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
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "calc(60px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--white)", borderTop: "1px solid var(--border)",
        display: "flex", zIndex: 200,
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
