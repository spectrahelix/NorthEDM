"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keep a half-filled form alive across a page reload — including the phone
 * throwing the whole page away.
 *
 * On 2026-10-10 a vendor lost a product form twice on opening the photo
 * picker. The first time the service worker reloaded for a new deploy (now
 * blocked site-wide while anything is typed). The second time no deploy
 * happened: page_views show the page starting fresh 17s after his photo
 * finished uploading, i.e. the phone itself reloaded it. A draft kept in
 * sessionStorage did not survive that (it does survive an ordinary reload —
 * tested), so this now uses localStorage, which outlives a tab or app restart.
 *
 * Drafts expire after MAX_AGE and are removed the moment the form is clean
 * (saved or cancelled), so one never resurfaces on someone else's visit long
 * after the fact. Keys include the vendor id, so accounts don't share drafts.
 *
 * Also marks <body data-unsaved="1"> while dirty; the service worker will not
 * reload a page carrying it.
 *
 * Returns true once a saved draft has been put back, so the page can say so.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function useUnsavedDraft<T>(
  key: string | null,
  value: T,
  dirty: boolean,
  restore: (saved: T) => void,
): boolean {
  const restored = useRef(false);
  const restoreRef = useRef(restore);
  const [didRestore, setDidRestore] = useState(false);
  useEffect(() => { restoreRef.current = restore; });

  // Put a saved draft back once, after mount. Deferred a tick so the restore's
  // setState doesn't run synchronously inside the effect.
  useEffect(() => {
    if (!key || restored.current) return;
    const t = setTimeout(() => {
      restored.current = true;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw) as { at?: number; value?: T };
        if (!saved.at || Date.now() - saved.at > MAX_AGE_MS || saved.value === undefined) {
          localStorage.removeItem(key);
          return;
        }
        restoreRef.current(saved.value);
        setDidRestore(true);
      } catch { /* storage blocked or corrupt — start empty */ }
    }, 0);
    return () => clearTimeout(t);
  }, [key]);

  // Mirror while dirty, drop once clean (saved or cancelled).
  useEffect(() => {
    if (!key || !restored.current) return;
    try {
      if (dirty) localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
      else localStorage.removeItem(key);
    } catch { /* storage full or blocked — the in-memory form still works */ }
  }, [key, value, dirty]);

  // Tell the service worker not to reload under unsaved work.
  useEffect(() => {
    if (dirty) document.body.dataset.unsaved = "1";
    else delete document.body.dataset.unsaved;
    return () => { delete document.body.dataset.unsaved; };
  }, [dirty]);

  return didRestore;
}
