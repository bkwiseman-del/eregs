"use client";

import { AnnotationPageLayout } from "@/components/annotations/AnnotationPageLayout";
import { UpgradeBanner } from "@/components/annotations/UpgradeBanner";

const iconLarge = (
  <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26A7 7 0 0012 2z" />
  </svg>
);

export default function InsightsPage() {
  return (
    <AnnotationPageLayout isPaid={false}>
      <UpgradeBanner
        feature="Insights"
        description="Get FMCSA guidance, official interpretations, Trucksafe videos, and expert articles — mapped directly to each regulation section as you read."
        icon={iconLarge}
      />
    </AnnotationPageLayout>
  );
}
