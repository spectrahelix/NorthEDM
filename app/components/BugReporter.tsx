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

const labelCls = "mb-1.5 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400";
const fieldCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#FF5C3A]/40 focus:outline-none";
const Req = () => <span className="text-[#FF5C3A]" aria-hidden="true"> *</span>;

export function BugReporter() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", pageManual: "", description: "", doingWhat: "",
    reporterName: "", contactEmail: "", contactPhone: "",
  });
  const [consent, setConsent] = useState(false);
  const [dmOk, setDmOk] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { attachListeners(); }, []);

  // Prefill the page field with wherever they opened the form — they can correct it.
  useEffect(() => {
    if (open && !form.pageManual && typeof window !== "undefined") {
      setForm((f) => ({ ...f, pageManual: window.location.pathname }));
    }
  }, [open, form.pageManual]);

  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

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
    setError("");
    // Friendly client-side checks; the server re-validates everything.
    if (!form.title.trim() || !form.pageManual.trim() || !form.description.trim() || !form.doingWhat.trim()) {
      setError("Please fill in every field marked with *.");
      return;
    }
    if (consent && !form.contactEmail.trim() && !form.contactPhone.trim() && !dmOk) {
      setError("You agreed to be contacted — please add an email, a phone number, or allow a NorthEDM message.");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.set("title", form.title);
    fd.set("pageManual", form.pageManual);
    fd.set("description", form.description);
    fd.set("doingWhat", form.doingWhat);
    fd.set("reporterName", form.reporterName);
    fd.set("contactConsent", String(consent));
    fd.set("contactEmail", form.contactEmail);
    fd.set("contactPhone", form.contactPhone);
    fd.set("contactDm", String(dmOk));
    fd.set("pageUrl", window.location.href);
    fd.set("userAgent", navigator.userAgent);
    fd.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    fd.set("consoleErrors", JSON.stringify(errorBuffer.slice(-8)));
    if (file) fd.set("file", file);

    const res = await fetch("/api/report", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Couldn't send. Try again.");
      return;
    }
    setDone(true);
  }

  function reset() {
    setOpen(false); setDone(false); setError("");
    setForm({ title: "", pageManual: "", description: "", doingWhat: "", reporterName: "", contactEmail: "", contactPhone: "" });
    setConsent(false); setDmOk(false); attach(null);
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
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 p-6"
          >
            {done ? (
              <div className="text-center">
                <div className="mb-3 text-4xl">🙏</div>
                <h3 className="font-bebas text-2xl tracking-wide text-white">Report sent</h3>
                <p className="mt-2 text-sm text-neutral-400">
                  Thank you — this gives us what we need to track it down.
                  {consent && " We'll reach out if we need more detail."}
                </p>
                <button onClick={reset} className="mt-5 rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90">Done</button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bebas text-2xl tracking-wide text-white">Report a problem</h3>
                  <button onClick={reset} aria-label="Close" className="text-neutral-500 hover:text-white">✕</button>
                </div>
                <p className="mb-5 text-sm text-neutral-400">
                  Fields marked <span className="text-[#FF5C3A]">*</span> are required. We automatically
                  include your browser and any errors — you don&apos;t need to.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="br-title">Title<Req /></label>
                    <input id="br-title" required value={form.title} onChange={(e) => set("title", e.target.value)}
                      className={fieldCls} placeholder="Short summary — e.g. Menu buttons don't respond" />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="br-page">Page where it happened<Req /></label>
                    <input id="br-page" required value={form.pageManual} onChange={(e) => set("pageManual", e.target.value)}
                      className={fieldCls} placeholder="/promote/codes, or describe where" />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="br-desc">What went wrong?<Req /></label>
                    <textarea id="br-desc" required rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
                      className={`${fieldCls} resize-none`} placeholder="What happened, and what did you expect instead?" />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="br-doing">What were you doing when it happened?<Req /></label>
                    <textarea id="br-doing" required rows={2} value={form.doingWhat} onChange={(e) => set("doingWhat", e.target.value)}
                      className={`${fieldCls} resize-none`} placeholder="e.g. I tapped the menu icon after logging in" />
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="br-name">Your name <span className="text-neutral-600">(optional)</span></label>
                    <input id="br-name" value={form.reporterName} onChange={(e) => set("reporterName", e.target.value)}
                      className={fieldCls} placeholder="So we know who found it" />
                  </div>

                  {/* Screenshot */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => attach(e.target.files?.[0] ?? null)} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
                      {file ? "Change screenshot" : "Attach screenshot"}
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {preview && <img src={preview} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                    <span className="font-dm-mono text-[10px] text-neutral-600">or paste an image</span>
                  </div>

                  {/* Contact consent */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#39FF14]" />
                      <span className="text-sm text-neutral-300">
                        I consent to being contacted about this report (follow-up questions or to confirm a fix).
                      </span>
                    </label>

                    {consent && (
                      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                        <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400">
                          How should we reach you?<Req />
                          <span className="ml-1 normal-case tracking-normal text-neutral-600">(at least one)</span>
                        </p>
                        <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)}
                          className={fieldCls} placeholder="Email" />
                        <input type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)}
                          className={fieldCls} placeholder="Phone" />
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input type="checkbox" checked={dmOk} onChange={(e) => setDmOk(e.target.checked)}
                            className="h-4 w-4 shrink-0 accent-[#39FF14]" />
                          <span className="text-sm text-neutral-300">Message me on NorthEDM</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {error && <p className="mt-4 rounded-xl bg-[#FF5C3A]/10 px-3 py-2 text-sm text-[#FF5C3A]">{error}</p>}

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
