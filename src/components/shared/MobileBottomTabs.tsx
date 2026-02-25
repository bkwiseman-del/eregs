"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
  proOnly?: boolean;
}

const tabs: Tab[] = [
  {
    label: "Regs",
    href: "/regs/390.1",
    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  },
  {
    label: "Notes",
    href: "/notes",
    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    proOnly: true,
  },
  {
    label: "Highlights",
    href: "/highlights",
    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    proOnly: true,
  },
  {
    label: "Saved",
    href: "/saved",
    icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
    proOnly: true,
  },
];

const lockBadge = (
  <svg width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"
    style={{ position: "absolute", top: 2, right: 2 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

export function MobileBottomTabs({ isPaid = false }: { isPaid?: boolean }) {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: 54,
      background: "var(--white)", borderTop: "1px solid var(--border)",
      display: "flex", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {tabs.map(tab => {
        const active = tab.href.startsWith("/regs")
          ? pathname.startsWith("/regs")
          : pathname === tab.href;
        const locked = tab.proOnly && !isPaid;

        return (
          <Link key={tab.label} href={tab.href} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 3, textDecoration: "none",
            position: "relative",
            color: locked ? "var(--border2)" : active ? "var(--accent)" : "var(--text3)",
            opacity: locked ? 0.55 : 1,
            fontSize: 10, fontWeight: 500, letterSpacing: "0.02em",
          }}>
            <div style={{ position: "relative" }}>
              {tab.icon}
              {locked && lockBadge}
            </div>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
