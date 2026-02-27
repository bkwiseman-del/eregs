"use client";

import { useSession } from "next-auth/react";
import { AnnotationPageLayout } from "./AnnotationPageLayout";
import { AnnotationListView } from "./AnnotationListView";
import { UpgradeBanner } from "./UpgradeBanner";

type PageType = "notes" | "highlights" | "saved";

const pageConfig = {
  notes: {
    title: "My Notes",
    apiType: "NOTE" as const,
    upgradeFeature: "Notes",
    upgradeDescription: "Add private notes to any paragraph in the regulations. Your notes sync across all your devices and show up right next to the rule text.",
    emptyTitle: "No notes yet",
    emptyDescription: "Tap any paragraph while reading, then tap Note to add your first one.",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    iconLarge: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    emptyIcon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  highlights: {
    title: "My Highlights",
    apiType: "HIGHLIGHT" as const,
    upgradeFeature: "Highlights",
    upgradeDescription: "Highlight important paragraphs as you read. Come back to them anytime — your highlights sync across all your devices.",
    emptyTitle: "No highlights yet",
    emptyDescription: "Tap any paragraph while reading, then tap Highlight to mark it.",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    iconLarge: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    emptyIcon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  saved: {
    title: "Saved Sections",
    apiType: "BOOKMARK" as const,
    upgradeFeature: "Bookmarks",
    upgradeDescription: "Save sections for quick access. Your bookmarks sync across devices so the rules you reference most are always one tap away.",
    emptyTitle: "No saved sections yet",
    emptyDescription: "Tap the bookmark icon while reading any section to save it here.",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
    iconLarge: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
    emptyIcon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
  },
};

export function AnnotationPage({ pageType }: { pageType: PageType }) {
  const config = pageConfig[pageType];
  const { data: sessionData, status } = useSession();
  const isPaid = status === "authenticated";
  const userRole = (sessionData?.user as any)?.role as string | undefined;
  const isFleet = ["FLEET_MANAGER", "ENTERPRISE_ADMIN", "ENTERPRISE_MANAGER", "INTERNAL"].includes(userRole ?? "");

  return (
    <AnnotationPageLayout isPaid={isPaid} isFleet={isFleet}>
      {status === "loading" ? (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div style={{
            width: 24, height: 24, border: "2.5px solid var(--border)",
            borderTopColor: "var(--accent)", borderRadius: "50%",
            margin: "0 auto",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !isPaid ? (
        <UpgradeBanner
          feature={config.upgradeFeature}
          description={config.upgradeDescription}
          icon={config.iconLarge}
        />
      ) : (
        <AnnotationListView
          type={config.apiType}
          emptyIcon={config.emptyIcon}
          emptyTitle={config.emptyTitle}
          emptyDescription={config.emptyDescription}
        />
      )}
    </AnnotationPageLayout>
  );
}
