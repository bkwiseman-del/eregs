"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const lockIcon = (
  <svg width="7" height="7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" style={{ position: "absolute", top: 4, right: 4 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  proOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Regs",
    href: "/regs/__CURRENT__",
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  },
  {
    label: "Notes",
    href: "/notes",
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    proOnly: true,
  },
  {
    label: "Highlights",
    href: "/highlights",
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    proOnly: true,
  },
  {
    label: "Saved",
    href: "/saved",
    icon: <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
    proOnly: true,
  },
];

export function NavRail({ isPaid = false, currentSection }: { isPaid?: boolean; currentSection?: string }) {
  const pathname = usePathname();
  const isRegs = pathname.startsWith("/regs");

  return (
    <nav style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      width: "var(--rail-w)", flexShrink: 0,
      background: "var(--white)", borderRight: "1px solid var(--border)",
      padding: "8px 0 16px", gap: 2, zIndex: 10
    }}>
      {/* Mini truck logo — paid only */}
      {isPaid && (
        <Link href="/dashboard" style={{ textDecoration: "none", marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, display: "flex", alignItems: "center",
            justifyContent: "center", borderRadius: 8, transition: "background .15s"
          }}>
            <svg width="22" height="22" viewBox="0 0 50 50" fill="none">
              <rect x="4" y="20" width="28" height="18" rx="3" fill="var(--accent)" opacity=".15"/>
              <rect x="4" y="20" width="28" height="18" rx="3" stroke="var(--accent)" strokeWidth="2.5"/>
              <path d="M32 28h8l4 6v4h-12V28z" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round"/>
              <circle cx="12" cy="40" r="4" stroke="var(--accent)" strokeWidth="2.5"/>
              <circle cx="38" cy="40" r="4" stroke="var(--accent)" strokeWidth="2.5"/>
              <rect x="10" y="12" width="18" height="10" rx="2" stroke="var(--accent)" strokeWidth="2" opacity=".5"/>
            </svg>
          </div>
        </Link>
      )}

      {/* Nav items */}
      {navItems.map((item) => {
        const href = item.href === "/regs/__CURRENT__"
          ? `/regs/${currentSection ?? "390.1"}`
          : item.href;
        const active = item.href === "/regs/__CURRENT__" ? isRegs : pathname === item.href;
        const locked = item.proOnly && !isPaid;
        return (
          <Link key={item.label} href={href} title={locked ? `${item.label} (Pro)` : item.label} style={{ textDecoration: "none" }}>
            <div style={{
              width: 44, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "7px 0", borderRadius: 8, cursor: "pointer",
              position: "relative",
              color: locked ? "var(--border2)" : active ? "var(--accent)" : "var(--text3)",
              background: active && !locked ? "var(--accent-bg)" : "transparent",
              opacity: locked ? 0.55 : 1,
              transition: "all .15s",
            }}>
              {item.icon}
              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.02em" }}>{item.label}</span>
              {locked && lockIcon}
            </div>
          </Link>
        );
      })}

      {isPaid && (
        <>
          <div style={{ width: 28, height: 1, background: "var(--border)", margin: "4px 0" }} />

          <Link href="/fleet" title="Fleet Dashboard" style={{ textDecoration: "none" }}>
            <div style={{
              width: 44, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "7px 0", borderRadius: 8, cursor: "pointer",
              color: "var(--text3)", transition: "all .15s"
            }}>
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span style={{ fontSize: 9, fontWeight: 500 }}>Fleet</span>
            </div>
          </Link>
        </>
      )}

      <div style={{ flex: 1 }} />

      {isPaid && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #a34f18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 600, color: "white", cursor: "pointer"
        }}>JD</div>
      )}
    </nav>
  );
}
