"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { registerServiceWorker } from "@/lib/pwa/register";

interface PWAContextValue {
  isOnline: boolean;
  isOffline: boolean;
  swReady: boolean;
}

const PWAContext = createContext<PWAContextValue>({
  isOnline: true,
  isOffline: false,
  swReady: false,
});

export function usePWA() {
  return useContext(PWAContext);
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    registerServiceWorker().then(() => setSwReady(true));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <PWAContext.Provider value={{ isOnline, isOffline: !isOnline, swReady }}>
      {children}
    </PWAContext.Provider>
  );
}
