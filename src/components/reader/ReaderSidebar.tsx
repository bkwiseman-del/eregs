"use client";

import { useState, useEffect } from "react";
import type { PartToc } from "@/lib/ecfr";

const FMCSR_PARTS: { part: string; title: string }[] = [
  { part: "40",  title: "Drug & Alcohol Testing Procedures" },
  { part: "376", title: "Lease and Interchange of Vehicles" },
  { part: "380", title: "Special Training Requirements" },
  { part: "381", title: "Waivers, Exemptions, and Pilot Programs" },
  { part: "382", title: "Controlled Substances and Alcohol Testing" },
  { part: "383", title: "Commercial Driver's License Standards" },
  { part: "385", title: "Safety Fitness Procedures" },
  { part: "386", title: "Rules of Practice for FMCSA Proceedings" },
  { part: "387", title: "Minimum Levels of Financial Responsibility" },
  { part: "390", title: "General Applicability and Definitions" },
  { part: "391", title: "Qualifications of Drivers" },
  { part: "392", title: "Driving of Commercial Motor Vehicles" },
  { part: "393", title: "Parts and Accessories for Safe Operation" },
  { part: "394", title: "Driving of Motor Vehicles (Rescinded)" },
  { part: "395", title: "Hours of Service of Drivers" },
  { part: "396", title: "Inspection, Repair, and Maintenance" },
  { part: "397", title: "Transportation of Hazardous Materials" },
  { part: "398", title: "Transportation of Migrant Workers" },
  { part: "399", title: "Employee Safety and Health Standards" },
];

interface Props {
  allTocs: Map<string, PartToc>;       // TOC data keyed by part number
  currentSection: string;               // e.g. "395.1"
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  onNavigate: (section: string) => void;
  onExpandPart: (part: string) => void; // Tell shell to fetch TOC for this part
}

export function ReaderSidebar({ allTocs, currentSection, open, onClose, isMobile, onNavigate, onExpandPart }: Props) {
  const currentPart = currentSection.split(".")[0];

  // Which part is expanded in the TOC (null = all collapsed)
  const [expandedPart, setExpandedPart] = useState<string | null>(currentPart);

  // Sync expanded part when navigating to a different part
  useEffect(() => {
    setExpandedPart(currentPart);
  }, [currentPart]);

  // The TOC for the currently expanded part (may be null if not yet loaded)
  const expandedToc = expandedPart ? allTocs.get(expandedPart) ?? null : null;

  // Active subpart — only meaningful within the current part
  const activeSubpartLabel = expandedPart === currentPart
    ? expandedToc?.subparts.find(sp => sp.sections.some(s => s.section === currentSection))?.label ?? null
    : null;

  // Explicitly open subparts. The active subpart is always added to this set.
  const [openSubparts, setOpenSubparts] = useState<Set<string>>(new Set());

  // Reset when part changes
  useEffect(() => {
    setOpenSubparts(new Set());
  }, [currentPart]);

  // Auto-open the active subpart whenever it changes
  useEffect(() => {
    if (activeSubpartLabel != null) {
      setOpenSubparts(prev => {
        if (prev.has(activeSubpartLabel)) return prev;
        const next = new Set(prev);
        next.add(activeSubpartLabel);
        return next;
      });
    }
  }, [activeSubpartLabel]);

  const isSubpartExpanded = (label: string, partNum: string) => {
    // For non-current parts, expand all subparts by default
    if (partNum !== currentPart) return true;
    return openSubparts.has(label);
  };

  const toggleSubpart = (label: string) => {
    setOpenSubparts(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handlePartClick = (part: string) => {
    if (expandedPart === part) {
      setExpandedPart(null);
    } else {
      setExpandedPart(part);
      onExpandPart(part); // Tell shell to fetch TOC if needed
    }
  };

  const containerStyle: React.CSSProperties = isMobile ? {
    position: "fixed", top: "var(--nav-h)", bottom: 0, left: 0,
    zIndex: 30, width: open ? 300 : 0, overflow: "hidden",
    transition: "width 0.25s ease",
    background: "var(--white)", borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
  } : {
    width: open ? 290 : 0, flexShrink: 0,
    overflow: "hidden", transition: "width 0.25s ease",
    background: "var(--white)", borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
  };

  return (
    <aside style={containerStyle}>
      <div style={{ width: isMobile ? 300 : 290, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>
            Title 49 · Transportation
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>FMCSRs</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>Subchapter B · Parts 40–399</div>
            </div>
            {isMobile && (
              <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text3)", padding: 4 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Parts list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {FMCSR_PARTS.map(({ part, title }) => {
            const isCurrentPart = part === currentPart;
            const isExpanded = expandedPart === part;
            const partToc = allTocs.get(part) ?? null;

            return (
              <div key={part}>
                {/* Part header — toggle only, never navigates */}
                <button
                  onClick={() => handlePartClick(part)}
                  style={{ width: "100%", border: "none", background: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 12px",
                    background: isCurrentPart ? "var(--accent-bg)" : "transparent",
                    borderLeft: isCurrentPart ? "2px solid var(--accent)" : "2px solid transparent",
                    transition: "all 0.1s",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0, flex: 1 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                        color: isCurrentPart ? "var(--accent)" : "var(--text)",
                        fontVariantNumeric: "tabular-nums"
                      }}>{part}</span>
                      <span style={{
                        fontSize: 12, lineHeight: 1.3,
                        color: isCurrentPart ? "var(--accent-text)" : "var(--text2)",
                        fontWeight: isCurrentPart ? 600 : 400,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>{title}</span>
                    </div>
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"
                      viewBox="0 0 24 24" style={{
                        flexShrink: 0, marginLeft: 4,
                        color: isCurrentPart ? "var(--accent)" : "var(--text3)",
                        transform: isExpanded ? "rotate(90deg)" : "none",
                        transition: "transform 0.2s"
                      }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </button>

                {/* Expanded sections */}
                {isExpanded && partToc && (
                  <div style={{ paddingBottom: 4 }}>
                    {partToc.subparts.map((subpart) => {
                      const expanded = isSubpartExpanded(subpart.label, part);
                      const hasActive = subpart.sections.some(s => s.section === currentSection);
                      return (
                        <div key={subpart.label || subpart.title}>
                          {/* Subpart header */}
                          <button
                            onClick={() => toggleSubpart(subpart.label)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center",
                              justifyContent: "space-between", padding: "5px 12px 5px 18px",
                              border: "none", background: "none", cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: hasActive ? "var(--accent)" : "var(--text3)",
                              letterSpacing: "0.07em", textTransform: "uppercase"
                            }}>
                              {subpart.label ? `Subpart ${subpart.label} — ${subpart.title}` : subpart.title}
                            </span>
                            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2"
                              viewBox="0 0 24 24" style={{
                                flexShrink: 0, color: "var(--text3)",
                                transform: expanded ? "rotate(180deg)" : "none",
                                transition: "transform 0.2s"
                              }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>

                          {/* Section links */}
                          {expanded && subpart.sections.map((sec) => {
                            const active = sec.section === currentSection;
                            return (
                              <a
                                key={sec.section}
                                href={`/regs/${sec.section}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  onNavigate(sec.section);
                                  if (isMobile) onClose();
                                }}
                                style={{ textDecoration: "none" }}
                              >
                                <div style={{
                                  display: "flex", alignItems: "baseline", gap: 8,
                                  padding: "5px 12px 5px 22px",
                                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                                  background: active ? "var(--accent-bg)" : "transparent",
                                  cursor: "pointer", transition: "all 0.1s",
                                }}>
                                  <span style={{
                                    fontSize: 11, fontWeight: 500, flexShrink: 0,
                                    color: active ? "var(--accent)" : "var(--text3)",
                                    minWidth: 38, fontVariantNumeric: "tabular-nums"
                                  }}>{sec.section}</span>
                                  <span style={{
                                    fontSize: 12, lineHeight: 1.35,
                                    color: active ? "var(--accent-text)" : "var(--text2)",
                                    fontWeight: active ? 500 : 400
                                  }}>{sec.title}</span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Loading indicator when TOC not yet fetched */}
                {isExpanded && !partToc && (
                  <div style={{ padding: "8px 18px", fontSize: 11, color: "var(--text3)" }}>
                    Loading…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
