"use client";

import { useEffect, useRef, useState } from "react";

// Rolling buffer of real JS errors on the page (attached once), so a report can
// include the actual crash even if it happened before the user opened the form.
type CapturedError = { message: string; source?: string; stack?: string; at: string };
const errorBuffer: CapturedError[] = [];
let listenersAttached = false;

function attachListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  const push = (e: CapturedError) => { errorBuffer.push(e); if (errorBuffer.length > 12) errorBuffer.shift(); };
  window.addEventListener("error", (ev) => {
    push({ message: String(ev.message || ev.error?.message || "error"), source: `${ev.filename ?? ""}:${ev.lineno ?? ""}:${ev.colno ?? ""}`, stack: ev.error?.stack?.slice(0, 2000), at: new Date().toISOString() });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    push({ message: `Unhandled promise rejection: ${r?.message ?? String(r)}`, stack: r?.stack?.slice(0, 2000), at: new Date().toISOString() });
  });
}

export function BugReporter() {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { attachListeners(); }, []);

  function attach(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  // Paste a screenshot straight into the form.
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = img?.getAsFile();
      if (f) attach(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  async function submit() {
    if (!desc.trim() && !file) { setError("Add a description or a screenshot."); return; }
    setBusy(true); setError("");
    const fd = new FormData();
    fd.set("description", desc);
    fd.set("pageUrl", window.location.href);
    fd.set("userAgent", navigator.userAgent);
    fd.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    fd.set("consoleErrors", JSON.stringify(errorBuffer.slice(-8)));
    if (file) fd.set("file", file);
    const res = await fetch("/api/report", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Couldn't send. Try again."); return; }
    setDone(true);
  }

  function reset() {
    setOpen(false); setDone(false); setDesc(""); attach(null); setError("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a problem"
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-900/80 px-3 py-2 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400 backdrop-blur transition hover:border-[#FF5C3A]/40 hover:text-[#FF5C3A]"
      >
        🐞 Report
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={reset}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-6">
            {done ? (
              <div className="text-center">
                <div className="mb-3 text-4xl">🙏</div>
                <h3 className="font-bebas text-2xl tracking-wide text-white">Report sent</h3>
                <p className="mt-2 text-sm text-neutral-400">Thank you — we&apos;ve got the details and we&apos;re on it.</p>
                <button onClick={reset} className="mt-5 rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90">Done</button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bebas text-2xl tracking-wide text-white">Report a problem</h3>
                  <button onClick={reset} aria-label="Close" className="text-neutral-500 hover:text-white">✕</button>
                </div>
                <p className="mb-4 text-sm text-neutral-400">
                  Tell us what looked wrong and attach a screenshot. We automatically include the page,
                  your browser, and any errors — you don&apos;t need to.
                </p>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={4}
                  placeholder="What happened? What did you expect?"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#FF5C3A]/40 focus:outline-none"
                />
                <div className="mt-3 flex items-center gap-3">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => attach(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
                    {file ? "Change screenshot" : "Attach screenshot"}
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview && <img src={preview} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <span className="font-dm-mono text-[10px] text-neutral-600">or paste an image</span>
                </div>
                {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={reset} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-400 hover:text-white">Cancel</button>
                  <button onClick={submit} disabled={busy} className="rounded-xl bg-[#FF5C3A] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                    {busy ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
