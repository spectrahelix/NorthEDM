"use client";
import { useEffect } from "react";

// Registers the PWA service worker (no-op where unsupported).
//
// Hardened so a deploy can never leave a user stuck on a stale, non-interactive
// page:
//   • the SW is registered with a per-build version (?v=…) so each deploy is a
//     new script the browser installs, purging the old caches;
//   • updateViaCache:'none' stops the browser from serving the SW script itself
//     from its HTTP cache, so updates are picked up promptly;
//   • when a new SW takes control (controllerchange), we reload exactly once so
//     the HTML and its hashed JS come from the same build — this is what fixes
//     "the page loads but nothing is tappable" right after a release.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const version = process.env.NEXT_PUBLIC_SW_VERSION || "static";

    // If a worker is already controlling this page, a later controllerchange
    // means a NEW build took over → reload once to match. On the very first
    // install there's no prior controller, so we must not reload.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(version)}`, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((reg) => {
        // Proactively check for a newer worker on load and whenever the tab is
        // refocused, so a returning user updates without a hard refresh.
        reg.update().catch(() => {});
        const onVisible = () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
