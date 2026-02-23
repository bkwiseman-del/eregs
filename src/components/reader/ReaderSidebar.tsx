"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { clsx } from "clsx";
import type { PartToc } from "@/lib/ecfr";

interface Props {
  toc: PartToc | null;
  currentSection: string;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export function ReaderSidebar({ toc, currentSection, open, onClose, isMobile }: Props) {
  if (!open) return null;

  return (
    <aside
      className={clsx(
        "bg-white border-r border-stone-200 overflow-y-auto flex-col z-30",
        isMobile
          ? "fixed inset-y-0 left-0 w-72 flex shadow-xl"
          : "flex w-64 shrink-0"
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-stone-200 shrink-0">
        <span className="text-sm font-semibold text-stone-700">
          {toc ? `Part ${toc.part}` : "Table of Contents"}
        </span>
        {isMobile && (
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Part title */}
      {toc && (
        <div className="px-4 py-3 border-b border-stone-100">
          <p className="text-xs text-stone-500 leading-snug">{toc.title}</p>
        </div>
      )}

      {/* TOC */}
      <nav className="flex-1 overflow-y-auto py-2">
        {toc?.subparts.map((subpart) => (
          <div key={subpart.label} className="mb-2">
            {subpart.label && (
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  {subpart.label ? `Subpart ${subpart.label}` : ""} {subpart.title}
                </span>
              </div>
            )}
            {subpart.sections.map((sec) => {
              const isActive = sec.section === currentSection;
              return (
                <Link
                  key={sec.section}
                  href={`/regs/${sec.section}`}
                  className={clsx(
                    "flex items-start gap-2 px-4 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-orange-50 text-orange-700 font-medium border-r-2 border-orange-500"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  <span className="shrink-0 font-mono text-xs mt-0.5 text-stone-400">
                    {sec.section}
                  </span>
                  <span className="leading-snug">{sec.title}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {!toc && (
          <div className="px-4 py-8 text-center text-sm text-stone-400">
            Loading contents...
          </div>
        )}
      </nav>
    </aside>
  );
}
