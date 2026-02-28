"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerProvider } from "./ServiceWorkerProvider";
import { OfflineIndicator } from "./OfflineIndicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerProvider>
        <OfflineIndicator />
        {children}
      </ServiceWorkerProvider>
    </SessionProvider>
  );
}
