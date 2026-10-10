"use client";

import { useEffect, useRef } from "react";

/**
 * Keep a half-filled form alive across a page reload.
 *
 * Two things reload a page under someone mid-form, and both hit the vendor
 * inventory form on 2026-10-10 the moment a vendor opened the photo picker:
 *
 *   1. ServiceWorkerRegister reloads when a new deploy takes over, and it
 *      checks for one whenever the tab becomes visible again — which is
 *      exactly what returning from the phone's photo picker does.
 *   2. Mobile browsers (iOS especially) may discard a backgrounded tab to free
 *      memory while the camera or photo library is open, and reload it after.
 *
 * (1) is prevented: while `dirty`, this marks <body data-unsaved="1"> and the
 * service worker skips its reload. (2) can't be prevented from a web page, so
 * the draft is mirrored to sessionStorage and put back on the next load.
 *
 * sessionStorage is per-tab and gone when the tab closes, so a draft never
 * outlives the visit or leaks to another person on the same device.
 */
export function useUnsavedDraft<T>(
  key: string | null,
  value: T,
  dirty: boolean,
  restore: (saved: T) => void,
) {
  const restored = useRef(false);
  const restoreRef = useRef(restore);
  useEffect(() => { restoreRef.current = restore; });

  // Put a saved draft back once, after mount. Deferred a tick so the restore's
  // setState doesn't run synchronously inside the effect.
  useEffect(() => {
    if (!key || restored.current) return;
    const t = setTimeout(() => {
      restored.current = true;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) restoreRef.current(JSON.parse(raw) as T);
      } catch { /* storage blocked or corrupt — start empty */ }
    }, 0);
    return () => clearTimeout(t);
  }, [key]);

  // Mirror while dirty, drop once clean (saved or cancelled).
  useEffect(() => {
    if (!key || !restored.current) return;
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
    } catch { /* storage full or blocked — the in-memory form still works */ }
  }, [key, value, dirty]);

  // Tell the service worker not to reload under unsaved work.
  useEffect(() => {
    if (dirty) document.body.dataset.unsaved = "1";
    else delete document.body.dataset.unsaved;
    return () => { delete document.body.dataset.unsaved; };
  }, [dirty]);
}
