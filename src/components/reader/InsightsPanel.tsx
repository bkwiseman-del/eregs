"use client";

import { X, Lightbulb, AlertTriangle, BookOpen, HelpCircle } from "lucide-react";
import type { EcfrSection } from "@/lib/ecfr";
import { clsx } from "clsx";

interface Props {
  section: EcfrSection;
  open: boolean;
  onClose: () => void;
}

// Static placeholder insights — will be replaced with AI-generated content
const INSIGHTS: Record<string, { type: "tip" | "warning" | "context" | "faq"; title: string; body: string }[]> = {
  "390.5": [
    {
      type: "context",
      title: "Why this section matters",
      body: "§ 390.5 is the definitions section for Part 390, the general applicability rules. Understanding these definitions is critical because they apply throughout all FMCSRs.",
    },
    {
      type: "tip",
      title: "Commercial Motor Vehicle definition",
      body: "The CMV definition includes weight thresholds (10,001 lbs GVWR), passenger counts (9+), and hazmat placarding. Know all three — inspectors use any of them.",
    },
    {
      type: "warning",
      title: "Driver vs. operator distinction",
      body: "A 'driver' operates the vehicle; a 'motor carrier' controls the operation. Both carry distinct obligations under the FMCSRs. Misunderstanding this can create compliance gaps.",
    },
  ],
};

const iconMap = {
  tip: { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  warning: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  context: { icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  faq: { icon: HelpCircle, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
};

export function InsightsPanel({ section, open, onClose }: Props) {
  const insights = INSIGHTS[section.section] || [];

  if (!open) return null;

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-stone-200 overflow-y-auto flex flex-col z-20">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-stone-700">Insights</span>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Section label */}
      <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
        <p className="text-xs font-mono text-orange-600">§ {section.section}</p>
        <p className="text-xs text-stone-500 mt-0.5 leading-snug">{section.title}</p>
      </div>

      {/* Insights */}
      <div className="flex-1 p-4 space-y-3">
        {insights.length > 0 ? (
          insights.map((insight, i) => {
            const { icon: Icon, color, bg, border } = iconMap[insight.type];
            return (
              <div key={i} className={clsx("rounded-xl border p-4", bg, border)}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className={color} />
                  <span className={clsx("text-xs font-semibold", color)}>{insight.title}</span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">{insight.body}</p>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Lightbulb size={24} className="text-stone-300 mx-auto mb-3" />
            <p className="text-sm text-stone-400">
              No insights yet for § {section.section}.
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Trucksafe insights coming soon.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-stone-200 bg-stone-50">
        <p className="text-[10px] text-stone-400 leading-snug">
          Insights are provided by Trucksafe and do not constitute legal advice. Always verify with current eCFR text.
        </p>
      </div>
    </aside>
  );
}
