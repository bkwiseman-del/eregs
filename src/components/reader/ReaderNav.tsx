"use client";

import Link from "next/link";
import { PanelLeft, Lightbulb, BookOpen, LayoutDashboard, Bookmark, StickyNote, Highlighter, Users } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  onToggleSidebar: () => void;
  onToggleInsights: () => void;
  sidebarOpen: boolean;
  insightsOpen: boolean;
  slug: string;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: BookOpen, label: "Regulations", href: "/regs/390.1" },
  { icon: Highlighter, label: "Highlights", href: "/highlights" },
  { icon: StickyNote, label: "Notes", href: "/notes" },
  { icon: Bookmark, label: "Saved", href: "/saved" },
  { icon: Users, label: "Fleet", href: "/fleet" },
];

export function ReaderNav({ onToggleSidebar, onToggleInsights, sidebarOpen, insightsOpen, slug }: Props) {
  return (
    <nav className="hidden md:flex flex-col w-14 bg-white border-r border-stone-200 shrink-0 z-30">
      {/* Logo */}
      <div className="h-14 flex items-center justify-center border-b border-stone-200">
        <Link href="/" className="text-lg font-serif font-semibold text-stone-900">
          e<span className="text-orange-600">R</span>
        </Link>
      </div>

      {/* Toggle sidebar */}
      <div className="p-2 border-b border-stone-200">
        <button
          onClick={onToggleSidebar}
          className={clsx(
            "w-full flex items-center justify-center h-10 rounded-lg transition-colors",
            sidebarOpen
              ? "bg-orange-50 text-orange-600"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          )}
          title="Toggle table of contents"
        >
          <PanelLeft size={18} />
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center justify-center h-10 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title={label}
          >
            <Icon size={18} />
          </Link>
        ))}
      </div>

      {/* Insights toggle */}
      <div className="p-2 border-t border-stone-200">
        <button
          onClick={onToggleInsights}
          className={clsx(
            "w-full flex items-center justify-center h-10 rounded-lg transition-colors",
            insightsOpen
              ? "bg-amber-50 text-amber-600"
              : "text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          )}
          title="Toggle insights"
        >
          <Lightbulb size={18} />
        </button>
      </div>
    </nav>
  );
}
