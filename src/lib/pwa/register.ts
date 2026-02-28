let swRegistration: ServiceWorkerRegistration | null = null;
let swReadyResolve: ((reg: ServiceWorkerRegistration) => void) | null = null;

export const swReady = new Promise<ServiceWorkerRegistration>((resolve) => {
  swReadyResolve = resolve;
});

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    swRegistration = reg;
    swReadyResolve?.(reg);

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("sw-updated"));
        }
      });
    });
  } catch (err) {
    console.warn("SW registration failed:", err);
  }
}

export function getSwRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}
