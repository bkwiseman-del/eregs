"use client";

import { useEffect } from "react";

/**
 * Adds `reader-lock` class to <body> on mount, removes on unmount.
 * Use in layouts/pages that need overflow:hidden (reader, dashboard, search).
 */
export function BodyScrollLock() {
  useEffect(() => {
    document.body.classList.add("reader-lock");
    return () => document.body.classList.remove("reader-lock");
  }, []);
  return null;
}
