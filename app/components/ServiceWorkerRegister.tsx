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

    // Has the visitor typed into anything on this page? Any form, site-wide —
    // so no page has to opt in. A reload under half-typed work wiped a
    // vendor's new product on 2026-10-10: this fires on returning to the tab,
    // which is exactly what coming back from a phone's photo picker does.
    // (utils/useUnsavedDraft.ts can also set data-unsaved explicitly.)
    let typed = false;
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) typed = true;
    };
    document.addEventListener("input", onInput, true);
    const hasUnsavedWork = () => typed || document.body.dataset.unsaved === "1";

    // With work on screen, the update waits for the visitor's next link click
    // and is applied as a full page load then. The running page's JS is
    // already loaded, so it keeps working until that click.
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      reloading = true;
      location.assign(url.href);
    };

    const onControllerChange = () => {
      if (!hadController || reloading) return;
      if (hasUnsavedWork()) {
        document.addEventListener("click", onLinkClick, true);
        return;
      }
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
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, []);
  return null;
}
