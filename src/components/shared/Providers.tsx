"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerProvider } from "./ServiceWorkerProvider";
import { OfflineIndicator } from "./OfflineIndicator";
import { PWAInstallBanner } from "./PWAInstallBanner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerProvider>
        <OfflineIndicator />
        <PWAInstallBanner />
        {children}
      </ServiceWorkerProvider>
    </SessionProvider>
  );
}
