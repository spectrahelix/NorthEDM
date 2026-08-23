"use client";
import { useEffect, useState } from "react";

// "Add to Home Screen" nudge. Installed users are the ones who come back, so we
// surface a dismissible banner when the browser signals the app is installable
// (Chrome/Android/Edge fire `beforeinstallprompt`). Hidden if already installed
// or previously dismissed. iOS Safari doesn't fire the event, so we don't nag
// there — it just won't show.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "ne_install_dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already installed → never show.
    if (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* ignore */ }
    if (dismissed) return;

    const onBIP = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setShow(false);
    setDeferred(null);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[9997] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/95 p-3 shadow-2xl backdrop-blur sm:left-auto sm:right-4 sm:mx-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/northedm-logo.svg" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install NorthEDM</p>
        <p className="text-xs text-neutral-400">Add it to your home screen — one tap to open, works like an app.</p>
      </div>
      <button
        onClick={install}
        className="shrink-0 rounded-xl bg-[#39FF14] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
      >
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 px-1 text-neutral-500 hover:text-white">
        ✕
      </button>
    </div>
  );
}
