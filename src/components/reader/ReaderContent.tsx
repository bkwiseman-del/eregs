"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { EcfrSection, EcfrParagraph } from "@/lib/ecfr";
import { clsx } from "clsx";

interface Props {
  section: EcfrSection;
  adjacent: { prev: string | null; next: string | null };
}

export function ReaderContent({ section, adjacent }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 md:px-12 md:py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-8">
        <span>Title 49</span>
        <span>›</span>
        <span>Part {section.part}</span>
        {section.subpartTitle && (
          <>
            <span>›</span>
            <span>
              {section.subpartLabel ? `Subpart ${section.subpartLabel} — ` : ""}
              {section.subpartTitle}
            </span>
          </>
        )}
      </div>

      {/* Section header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-mono text-orange-600 mb-1">§ {section.section}</p>
            <h1 className="text-2xl font-serif font-semibold text-stone-900 leading-snug">
              {section.title}
            </h1>
          </div>
          <a
            href={`https://www.ecfr.gov/current/title-49/part-${section.part}/section-${section.section}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mt-1"
          >
            eCFR <ExternalLink size={11} />
          </a>
        </div>

        <div className="mt-4 h-px bg-stone-200" />
      </header>

      {/* Content */}
      <article className="prose-reg">
        {section.content.length > 0 ? (
          section.content.map((para) => (
            <Paragraph key={para.id} para={para} />
          ))
        ) : (
          <div className="text-center py-16 text-stone-400">
            <p className="text-sm">Content unavailable. View on eCFR directly.</p>
            <a
              href={`https://www.ecfr.gov/current/title-49/part-${section.part}/section-${section.section}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
            >
              Open on eCFR <ExternalLink size={13} />
            </a>
          </div>
        )}
      </article>

      {/* Prev / Next navigation */}
      <div className="mt-16 pt-8 border-t border-stone-200 flex items-center justify-between gap-4">
        {adjacent.prev ? (
          <Link
            href={`/regs/${adjacent.prev}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors group"
          >
            <ChevronLeft size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
            <span>
              <span className="block text-xs text-stone-400 mb-0.5">Previous</span>
              § {adjacent.prev}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {adjacent.next ? (
          <Link
            href={`/regs/${adjacent.next}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition-colors group text-right"
          >
            <span>
              <span className="block text-xs text-stone-400 mb-0.5">Next</span>
              § {adjacent.next}
            </span>
            <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function Paragraph({ para }: { para: EcfrParagraph }) {
  const indent = para.level * 24;

  return (
    <div
      id={`p-${para.id}`}
      className="mb-4 scroll-mt-8"
      style={{ paddingLeft: indent }}
    >
      <p className="text-stone-800 leading-relaxed text-[15px]">
        {para.label && para.label !== para.id && (
          <span className="font-semibold text-stone-700 mr-1">({para.label})</span>
        )}
        {para.text}
      </p>
      {para.children && para.children.map((child) => (
        <Paragraph key={child.id} para={child} />
      ))}
    </div>
  );
}
