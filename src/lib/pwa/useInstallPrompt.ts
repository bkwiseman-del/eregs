"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "eregs-pwa-install-dismissed";
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const expiry = Number(raw);
  if (Date.now() > expiry) {
    localStorage.removeItem(DISMISS_KEY);
    return false;
  }
  return true;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true); // default hidden until checked
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    setDismissed(isDismissed());

    // Chrome/Edge: capture the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect successful install
    const installHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    const expiry = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(expiry));
    setDismissed(true);
  }, []);

  return {
    /** True if native install prompt is available (Chrome/Edge) */
    canPrompt: !!deferredPrompt,
    /** True if on iOS (needs manual instructions) */
    isIOS: isIOS(),
    /** True if already running as installed PWA */
    installed,
    /** True if user dismissed the banner recently */
    dismissed,
    /** Trigger the native install prompt (Chrome/Edge only) */
    promptInstall,
    /** Dismiss the banner for DISMISS_DAYS days */
    dismiss,
    /** True if we should show install UI (not installed, not dismissed, is mobile) */
    shouldShow: !installed && !dismissed,
  };
}
