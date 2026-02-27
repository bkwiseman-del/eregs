"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

/* ── Shared SVG icons ──────────────────────────────────────────────────────── */

const Check = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const X = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronDown = () => (
  <svg className="faq-arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── FAQ Data ──────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "Is eRegs legally compliant for driver distribution?",
    a: 'Yes. The FMCSRs require that carriers instruct drivers on the regulations — not that they hand over physical books. 49 CFR 390.32 explicitly permits electronic distribution. eRegs provides a timestamped acknowledgement receipt you can place in each driver\'s DQ file.',
  },
  {
    q: "How often is the regulation text updated?",
    a: "eRegs pulls directly from eCFR.gov and updates automatically when the Federal Register publishes amendments. You'll see the effective date on every section, and receive a notification if a section you've annotated changes.",
  },
  {
    q: "What parts of Title 49 are covered?",
    a: "eRegs covers the 18 parts most relevant to motor carrier compliance under Title 49, Subtitle B, Chapter III — including Parts 390–399 (the FMCSRs core), plus Parts 380, 382, 383, 384, 385, 386, 387, and 389.",
  },
  {
    q: "Do drivers need to download an app?",
    a: "No. Drivers access eRegs via a link in their browser — no app store, no account creation required. This is designed specifically for fleets with locked-down devices or drivers who don't regularly check personal email.",
  },
  {
    q: "What is Trucksafe content?",
    a: "eRegs is affiliated with Trucksafe Consulting, a leading DOT training and consulting firm. Trucksafe produces videos, articles, and podcasts that explain regulatory nuances in plain language. This content surfaces directly alongside the relevant regulation text in the eRegs reader.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel directly from your account settings at any time. Your subscription remains active until the end of your billing period. Driver invites already sent remain valid — there's no per-driver recurring charge.",
  },
];

/* ── Count-up animation ────────────────────────────────────────────────────── */

function CountUp({ end, prefix = "", suffix = "", duration = 1600 }: {
  end: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, end, duration]);

  return <div ref={ref}>{prefix}{value.toLocaleString()}{suffix}</div>;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function MarketingPage() {
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set([0, 1]));

  const toggleFaq = (i: number) => {
    setOpenFaq((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "var(--bg)", color: "var(--text)", lineHeight: 1.6 }}>
      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, background: "rgba(250,249,247,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)", zIndex: 100, padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <Image src="/images/logo-wordmark.svg" alt="eRegs" width={100} height={36} style={{ display: "block" }} />
        </Link>
        <div className="mkt-nav-links" style={{ display: "flex", gap: 24, marginLeft: "auto" }}>
          <a href="#features" style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>Features</a>
          <a href="#fleet" style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>For Fleets</a>
          <a href="#pricing" style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>Pricing</a>
          <a href="#faq" style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>FAQ</a>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 16 }}>
          <Link href="/login" style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500,
            color: "var(--text2)", border: "1px solid var(--border)", background: "transparent",
          }}>
            Log in
          </Link>
          <Link href="/signup" style={{
            padding: "9px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            color: "white", background: "var(--accent)", border: "none",
          }}>
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{
        background: "var(--dark, #0f0e0c)", color: "white", padding: "80px 24px 0",
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: -150, right: -100, width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(201,106,42,0.3) 0%,rgba(201,106,42,0.1) 40%,transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: -200, left: -150, width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(201,106,42,0.15) 0%,transparent 65%)",
        }} />
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
            background: "rgba(201,106,42,0.12)", border: "1px solid rgba(201,106,42,0.25)",
            padding: "5px 14px", borderRadius: 20, marginBottom: 24,
          }}>
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            The FMCSRs — Rebuilt for Safety Professionals
          </div>
          <h1 style={{
            fontFamily: "'Lora', serif", fontSize: "clamp(32px,4.8vw,56px)", fontWeight: 600,
            lineHeight: 1.15, color: "white", marginBottom: 20, maxWidth: 720, margin: "0 auto 20px",
          }}>
            The regulations your fleet runs on, <em style={{ color: "var(--accent)", fontStyle: "normal" }}>actually readable.</em>
          </h1>
          <p style={{
            fontSize: "clamp(16px,2.2vw,20px)", color: "rgba(255,255,255,0.65)",
            maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.6,
          }}>
            eRegs transforms the Federal Motor Carrier Safety Regulations into an always-current, annotatable, and searchable platform — with expert guidance built right in.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
            <Link href="/signup" style={{
              padding: "14px 32px", borderRadius: 10, fontSize: 16, fontWeight: 600,
              color: "white", background: "var(--accent)", border: "none",
            }}>
              Start 14-Day Free Trial
            </Link>
            <Link href="/regs/390.5" style={{
              padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.08)",
            }}>
              See How It Works
            </Link>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.35)", marginBottom: 48 }}>
            No credit card required · <strong style={{ color: "rgba(255,255,255,0.55)" }}>14-day free trial</strong> · Cancel anytime
          </p>
        </div>

        {/* App Preview */}
        <div style={{ position: "relative", maxWidth: 840, margin: "0 auto" }}>
          <div style={{
            background: "#1a1916", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px 16px 0 0", overflow: "hidden", boxShadow: "0 -20px 80px rgba(0,0,0,0.6)",
          }}>
            <div style={{
              background: "#242220", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div>
                <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", marginRight: 5, background: "#ff5f57" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", marginRight: 5, background: "#febc2e" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", background: "#28c840" }} />
              </div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>eregs.app/regs/390.5</div>
            </div>
            <div className="mkt-preview-screen" style={{
              display: "grid", gridTemplateColumns: "220px 1fr 280px", height: 380, overflow: "hidden",
            }}>
              {/* Sidebar */}
              <div className="mkt-preview-sidebar" style={{ background: "#1a1916", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "16px 0" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "14px 16px 5px" }}>Part 390</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 390.3 General applicability</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--accent)", background: "rgba(201,106,42,0.08)" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>§ 390.5</span> Definitions
                </div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 390.7 Rules of construction</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "14px 16px 5px" }}>Part 391</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 391.11 Qualifications of drivers</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 391.21 Application for employment</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "14px 16px 5px" }}>Part 395</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 395.3 Maximum driving time</div>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>§ 395.8 Records of duty status</div>
              </div>

              {/* Main content */}
              <div style={{ background: "#18160f", overflow: "hidden", padding: "24px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 600, color: "rgba(42,157,92,0.9)", background: "rgba(42,157,92,0.1)",
                    border: "1px solid rgba(42,157,92,0.2)", padding: "2px 8px", borderRadius: 10,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(42,157,92,0.9)", display: "inline-block" }} />
                    Current · Jan 15, 2026
                  </div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--accent)", marginBottom: 6 }}>§ 390.5</div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 18, color: "rgba(255,255,255,0.9)", marginBottom: 16, fontWeight: 500 }}>Definitions</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, padding: "7px 8px", borderRadius: 6 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(201,106,42,0.7)", flexShrink: 0, paddingTop: 2 }}>(a)</div>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                    <em style={{ color: "rgba(201,106,42,0.9)", fontStyle: "normal" }}>Accident</em> means an occurrence involving a commercial motor vehicle operating on a highway in interstate or intrastate commerce...
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, padding: "7px 8px", borderRadius: 6, background: "rgba(253,224,71,0.1)", border: "1px solid rgba(253,224,71,0.2)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(201,106,42,0.7)", flexShrink: 0, paddingTop: 2 }}>(b)</div>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                    <em style={{ color: "rgba(201,106,42,0.9)", fontStyle: "normal" }}>Commercial motor vehicle</em> means any self-propelled or towed motor vehicle used on a highway in interstate commerce to transport passengers or property when the vehicle has a gross vehicle weight rating...
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, padding: "7px 8px", borderRadius: 6, background: "rgba(201,106,42,0.12)", border: "1px solid rgba(201,106,42,0.25)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(201,106,42,0.7)", flexShrink: 0, paddingTop: 2 }}>(d)</div>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                    <em style={{ color: "rgba(201,106,42,0.9)", fontStyle: "normal" }}>Driver</em> means any person who operates any commercial motor vehicle.
                  </div>
                </div>
              </div>

              {/* Panel */}
              <div className="mkt-preview-panel" style={{ background: "#1a1916", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>FMCSA Guidance</div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 5 }}>FMCSA Interpretation</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.4, marginBottom: 4 }}>CMV Weight Threshold — GCWR vs. GVWR</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>When towing, use the higher of GCWR or GVWR to determine CMV status...</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2563b0", marginBottom: 5 }}>Trucksafe Video</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", lineHeight: 1.4, marginBottom: 4 }}>Are You a CMV? Understanding the Thresholds</div>
                  <div style={{ fontSize: 10.5, color: "rgba(59,130,246,0.6)", lineHeight: 1.5 }}>9 min · Trucksafe Consulting</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>What makes eRegs different</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 500, lineHeight: 1.2, marginBottom: 16, color: "var(--text)" }}>
            Built for the people who actually live with these regulations.
          </div>
          <p style={{ fontSize: 17, color: "var(--text2)", maxWidth: 560, lineHeight: 1.65 }}>
            Not a PDF viewer. Not just a search box. A purpose-built compliance reading environment — with the guidance layer that makes the difference.
          </p>

          <div className="mkt-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 52 }}>
            {[
              { color: "orange", title: "FMCSA Guidance Built In", body: "Official FMCSA interpretations and guidance letters surface inline as you read — right where they're relevant, not buried in a separate search.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg> },
              { color: "green", title: "Always Current", body: "Regulation text syncs directly from eCFR.gov. Every update, every amendment — automatically reflected. You'll never read an outdated version again.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg> },
              { color: "blue", title: "Highlights & Notes", body: "Annotate any paragraph with highlights and notes. Everything syncs across your devices and stays attached to the right section even when text changes.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
              { color: "orange", title: "Full-Text Search", body: "Search across all 18 covered parts in milliseconds. Find the regulation you need without knowing the part number or section — just describe what you're looking for.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
              { color: "blue", title: "Trucksafe Educational Content", body: "Videos, articles, and podcasts from Trucksafe Consulting appear directly alongside the regulations they explain. No jumping between tabs.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg> },
              { color: "green", title: "AI Regulatory Assistant", body: "Ask questions about any regulation in plain language. Get accurate answers with citations to specific sections and links to relevant FMCSA guidance.", icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg> },
            ].map((feat) => (
              <div key={feat.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                  ...(feat.color === "orange" ? { background: "var(--accent-bg)", border: "1px solid var(--accent-border)", color: "var(--accent)" }
                    : feat.color === "green" ? { background: "var(--green-bg)", border: "1px solid var(--green-border)", color: "var(--green)" }
                    : { background: "var(--blue-bg)", border: "1px solid var(--blue-border)", color: "var(--blue)" }),
                }}>
                  {feat.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{feat.title}</div>
                <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{feat.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ──────────────────────────────────────────────────────── */}
      <section style={{ background: "#0f0e0c", color: "white", padding: "72px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div className="mkt-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 64 }}>
            {[
              { end: 1800, prefix: "", suffix: "+", label: "Safety professionals using eRegs" },
              { end: 18, prefix: "", suffix: "", label: "CFR Parts covered under Title 49" },
              { end: 4200, prefix: "", suffix: "+", label: "Driver invites sent through the platform" },
              { end: 0, prefix: "$", suffix: "", label: "Per driver after the one-time $4 invite" },
            ].map((s) => (
              <div key={s.label} style={{
                textAlign: "center", padding: "28px 16px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
              }}>
                <div style={{ fontSize: 38, fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                  <CountUp end={s.end} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mkt-quotes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { text: "I used to have to keep a physical book at my desk and manually check for updates. With eRegs I just open it and know I'm reading the current version. The FMCSA guidance cards alone are worth the subscription.", name: "Karen L.", role: "Safety Director, Mid-size Carrier", initials: "KL" },
              { text: "We save thousands a year on regulation books. I send drivers an eRegs invite, they accept on their phone, and I download the acknowledgement receipt. It takes about two minutes per driver.", name: "Marcus T.", role: "Fleet Safety Manager, 80-truck operation", initials: "MT" },
            ].map((q) => (
              <div key={q.name} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: 24,
              }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, marginBottom: 16, fontStyle: "italic" }}>
                  &ldquo;{q.text}&rdquo;
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg,var(--accent),#8a3f10)", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
                  }}>{q.initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{q.name}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>{q.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLEET FEATURE ─────────────────────────────────────────────────────── */}
      <section id="fleet" style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "80px 24px" }}>
        <div className="mkt-fleet-inner" style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>For Fleet Safety Managers</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 500, lineHeight: 1.2, marginBottom: 16 }}>Stop buying regulation books.</div>
            <p style={{ fontSize: 17, color: "var(--text2)", maxWidth: 560, lineHeight: 1.65 }}>
              Federal regulations don&apos;t require physical books — they require that you provide and instruct drivers on the regulations. eRegs is built for exactly this.
            </p>
            <div style={{ marginTop: 28 }}>
              {[
                { num: "1", title: "Add your drivers", body: "Send a driver invite from your account. Each invite costs $4 — a one-time fee, no ongoing charge per driver." },
                { num: "2", title: "Drivers get instant access", body: "Drivers receive a link — no app store required, works in any browser. Supports the QR code and access code flow for locked-down devices." },
                { num: "3", title: "Download your receipt", body: "Once a driver accepts, you get a downloadable acknowledgement receipt for their Driver Qualification file. Done." },
              ].map((step) => (
                <div key={step.num} style={{ display: "flex", gap: 14, marginBottom: 24 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "white",
                    fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>{step.num}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{step.title}</div>
                    <div style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55 }}>{step.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
              &quot;The regulations explicitly allow carriers to meet these obligations via electronic means.&quot; — 49 CFR 390.32
            </div>
          </div>

          {/* Fleet Visual */}
          <div style={{
            background: "var(--white)", border: "1px solid var(--border)", borderRadius: 16,
            padding: 28, boxShadow: "0 4px 32px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 16 }}>
              Driver Distribution · Fleet Pro LLC
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                { initials: "RJ", name: "Ricky Johnson", status: "Acknowledged", ack: true },
                { initials: "TW", name: "Tony Williams", status: "Acknowledged", ack: true },
                { initials: "LS", name: "Lisa Sanchez", status: "Invite sent", ack: false },
                { initials: "DM", name: "Derek Mason", status: "Acknowledged", ack: true },
              ].map((d) => (
                <div key={d.name} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--border)",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "var(--bg3)",
                    border: "1px solid var(--border2)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--text2)", flexShrink: 0,
                  }}>{d.initials}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{d.name}</div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                    ...(d.ack
                      ? { color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--green-border)" }
                      : { color: "var(--accent)", background: "var(--accent-bg)", border: "1px solid var(--accent-border)" }),
                  }}>{d.status}</div>
                </div>
              ))}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 8, border: "1px solid var(--green-border)", background: "var(--green-bg)",
            }}>
              <svg style={{ color: "var(--green)" }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--green)" }}>Download DQ file receipts (3)</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>PDF acknowledgements ready to save</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: "var(--white)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>Pricing</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 500, lineHeight: 1.2, maxWidth: 600, margin: "0 auto 12px" }}>
              Simple pricing. No surprises.
            </div>
            <p style={{ fontSize: 17, color: "var(--text2)", margin: "0 auto", maxWidth: 560, lineHeight: 1.65 }}>
              One flat subscription. Upgrade to Fleet Manager when you need driver management.
            </p>
          </div>

          <div className="mkt-pricing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 48, maxWidth: 700, margin: "48px auto 0" }}>
            {/* Pro */}
            <div style={{ border: "1px solid var(--accent-border)", borderRadius: 16, padding: 28, background: "var(--accent-bg)", position: "relative" }}>
              <div style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "var(--accent)", color: "white", fontSize: 10.5, fontWeight: 700,
                padding: "4px 14px", borderRadius: 20, letterSpacing: "0.05em", whiteSpace: "nowrap",
              }}>Most Popular</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Pro</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                <sup style={{ fontSize: 20, fontWeight: 600, verticalAlign: "super", marginRight: 2 }}>$</sup>9
                <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text3)" }}> / month</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text2)", margin: "12px 0 20px", lineHeight: 1.55 }}>
                Full regulation access with annotations, insights, AI assistant, and search.
              </div>
              <Link href="/signup" style={{
                display: "block", width: "100%", padding: 12, borderRadius: 9, fontSize: 14, fontWeight: 600,
                textAlign: "center", background: "var(--accent)", color: "white", border: "none", marginTop: 20,
              }}>Start Free Trial</Link>
              <div style={{ fontSize: 11.5, color: "var(--text3)", textAlign: "center", marginTop: 10 }}>14-day free trial, no credit card required</div>
              <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
              {[
                "Full regulatory text, always current",
                "Highlights, bookmarks & notes",
                "FMCSA guidance cards",
                "Trucksafe videos, articles & podcasts",
                "AI regulatory assistant (20 questions/day)",
                "Full-text search with boolean operators",
                "Change notifications on saved sections",
                "Sync across all devices",
              ].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "var(--text2)", marginBottom: 10, lineHeight: 1.45 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }}><Check /></span>
                  {f}
                </div>
              ))}
            </div>

            {/* Fleet Manager */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 28, background: "var(--bg)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Fleet Manager</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
                <sup style={{ fontSize: 20, fontWeight: 600, verticalAlign: "super", marginRight: 2 }}>$</sup>19
                <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text3)" }}> / month</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text2)", margin: "12px 0 20px", lineHeight: 1.55 }}>
                Everything in Pro, plus driver management and acknowledgement tracking.
              </div>
              <Link href="/signup" style={{
                display: "block", width: "100%", padding: 12, borderRadius: 9, fontSize: 14, fontWeight: 600,
                textAlign: "center", background: "transparent", color: "var(--text2)",
                border: "1px solid var(--border2)", marginTop: 20,
              }}>Start Free Trial</Link>
              <div style={{ fontSize: 11.5, color: "var(--text3)", textAlign: "center", marginTop: 10 }}>14-day free trial</div>
              <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
              {[
                { text: "Everything in Pro", included: true },
                { text: "Invite & manage drivers", included: true },
                { text: "Acknowledgement receipt workflow", included: true },
                { text: "2 free driver invites to start", included: true },
                { text: "$4 per additional driver invite", included: true },
                { text: "Downloadable DQ file receipts", included: true },
              ].map((f) => (
                <div key={f.text} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "var(--text2)", marginBottom: 10, lineHeight: 1.45 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }}><Check /></span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13.5, color: "var(--text3)" }}>
            Saving thousands vs. physical regulation books.{" "}
            <a href="#fleet" style={{ color: "var(--accent)" }}>See how much your fleet saves &rarr;</a>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 12 }}>FAQ</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 500, lineHeight: 1.2 }}>Common questions</div>

          <div className="mkt-faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginTop: 40 }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq.has(i);
              const isOdd = i % 2 === 0;
              return (
                <div
                  key={i}
                  style={{
                    padding: "20px 0",
                    borderBottom: "1px solid var(--border)",
                    ...(isOdd ? { paddingRight: 32 } : { paddingLeft: 32, borderLeft: "1px solid var(--border)" }),
                  }}
                >
                  <div
                    onClick={() => toggleFaq(i)}
                    style={{
                      fontSize: 15, fontWeight: 600, marginBottom: isOpen ? 8 : 0, cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                    }}
                  >
                    {item.q}
                    <span style={{
                      flexShrink: 0, color: "var(--text3)", transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}>
                      <ChevronDown />
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.65 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0f0e0c", padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Lora', serif", fontSize: "clamp(28px,4vw,44px)", color: "white", marginBottom: 16, fontWeight: 500 }}>
          Stop wrestling with the regulations.<br />Start understanding them.
        </h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.55)", marginBottom: 36, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          Try eRegs free for 14 days. No credit card. Cancel anytime. Most safety managers are up and running in under five minutes.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/signup" style={{
            padding: "14px 32px", borderRadius: 10, fontSize: 16, fontWeight: 600,
            color: "white", background: "var(--accent)", border: "none",
          }}>Start Your Free Trial</Link>
          <a href="mailto:support@eregs.app" style={{
            padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.08)",
          }}>Talk to Us First</a>
        </div>
        <div style={{ marginTop: 36, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
          eRegs is an affiliate of <a href="https://trucksafe.com" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>Trucksafe Consulting, LLC</a> — a leading provider of DOT training and consulting services.
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#1a1916", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Image src="/images/logo-stacked.svg" alt="eRegs" width={120} height={120} style={{ display: "block", marginBottom: 14, opacity: 0.5 }} />
            <div style={{ color: "rgba(255,255,255,0.2)" }}>&copy; 2026 eRegs, LLC. All rights reserved.</div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/terms" style={{ color: "rgba(255,255,255,0.35)" }}>Terms</Link>
            <Link href="/privacy" style={{ color: "rgba(255,255,255,0.35)" }}>Privacy</Link>
            <a href="mailto:support@eregs.app" style={{ color: "rgba(255,255,255,0.35)" }}>Support</a>
            <a href="https://trucksafe.com" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.35)" }}>Trucksafe</a>
          </div>
        </div>
      </footer>

      {/* ── RESPONSIVE STYLES ─────────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .mkt-nav-links { display: none !important; }
          .mkt-features-grid,
          .mkt-pricing-grid,
          .mkt-stats-grid,
          .mkt-quotes-grid,
          .mkt-fleet-inner,
          .mkt-faq-grid { grid-template-columns: 1fr !important; }
          .mkt-preview-sidebar,
          .mkt-preview-panel { display: none !important; }
          .mkt-preview-screen { grid-template-columns: 1fr !important; }
          .mkt-faq-grid > div { padding-left: 0 !important; padding-right: 0 !important; border-left: none !important; }
        }
      `}</style>
    </div>
  );
}
