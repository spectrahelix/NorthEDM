"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { USERNAME_RULES, usernameProblem } from "@/utils/username";

// Shown once to any signed-in account that never chose a username: Google
// sign-ins (who get their email prefix), admin-created accounts, and anyone
// whose signup predates the stamp. "Later" hides it for this browser session;
// keeping or saving a name stamps username_chosen_at and it never returns.
const LATER_KEY = "ne_username_later";
const QUIET_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/"];

export function UsernamePrompt({ current, suggestion }: { current: string | null; suggestion: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  const [value, setValue] = useState(current ?? suggestion);
  const [remote, setRemote] = useState<{ for: string; ok: boolean; text: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let later = false;
    try { later = sessionStorage.getItem(LATER_KEY) === "1"; } catch { /* storage unavailable */ }
    const quiet = QUIET_PATHS.some((p) => (pathname ?? "").startsWith(p));
    const t = setTimeout(() => setHidden(later || quiet), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Local rules are derived during render; only the availability answer from
  // the server is state, set when the request returns.
  const v = value.trim();
  const localProblem = v ? usernameProblem(v) : null;
  const isCurrent = !!current && v.toLowerCase() === current.toLowerCase();
  useEffect(() => {
    if (hidden || !v || localProblem || isCurrent) return;
    let on = true;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/profile/username?u=${encodeURIComponent(v)}`);
      const j = await res.json().catch(() => ({}));
      if (!on) return;
      setRemote({ for: v, ok: !!j.ok, text: j.ok ? "Available." : j.problem ?? "Not available." });
    }, 400);
    return () => { on = false; clearTimeout(t); };
  }, [v, localProblem, isCurrent, hidden]);

  const status: { kind: "idle" | "checking" | "ok" | "bad"; text?: string } = saveError
    ? { kind: "bad", text: saveError }
    : !v ? { kind: "idle" }
    : localProblem ? { kind: "bad", text: localProblem }
    : isCurrent ? { kind: "ok", text: "That's yours already." }
    : remote && remote.for === v ? { kind: remote.ok ? "ok" : "bad", text: remote.text }
    : { kind: "checking", text: "Checking…" };

  if (hidden) return null;

  async function save(keep: boolean) {
    setBusy(true);
    const res = await fetch("/api/profile/username", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keep ? { keep: true } : { username: value.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setSaveError(j.error ?? "Couldn't save that."); return; }
    setHidden(true);
    router.refresh();
  }
  function later() {
    try { sessionStorage.setItem(LATER_KEY, "1"); } catch { /* ignore */ }
    setHidden(true);
  }

  const canSave = status.kind === "ok" && !busy && v.length > 0;
  const changed = !isCurrent;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="username-prompt-title">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">Welcome to NorthEDM</p>
        <h2 id="username-prompt-title" className="mt-1 font-bebas text-3xl tracking-wide text-white">Pick your username</h2>
        <p className="mt-2 text-sm text-neutral-400">
          It&apos;s how you appear on the forum, on FestDash and on your shop.{" "}
          {current ? <>We suggested <span className="font-dm-mono text-neutral-200">@{current}</span> from your email — keep it or choose your own.</> : null}
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Username</span>
          <div className="flex items-center rounded-xl border border-white/10 bg-black/30 focus-within:border-orange-500/50">
            <span className="pl-4 text-neutral-500">@</span>
            <input
              ref={inputRef}
              autoFocus
              value={value}
              onChange={(e) => { setSaveError(null); setValue(e.target.value.replace(/\s/g, "")); }}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent px-2 py-3 text-sm text-white outline-none"
              placeholder="yourname"
            />
          </div>
        </label>
        <p className={`mt-1.5 min-h-[1.25rem] text-xs ${status.kind === "bad" ? "text-red-400" : status.kind === "ok" ? "text-green-400" : "text-neutral-500"}`}>
          {status.text ?? USERNAME_RULES}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {changed ? (
            <button onClick={() => save(false)} disabled={!canSave} className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
              {busy ? "Saving…" : "Save username"}
            </button>
          ) : (
            <button onClick={() => save(true)} disabled={busy} className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
              {busy ? "Saving…" : `Keep @${current}`}
            </button>
          )}
          {current && changed && (
            <button onClick={() => setValue(current)} disabled={busy} className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 hover:bg-white/5">
              Keep @{current}
            </button>
          )}
          <button onClick={later} disabled={busy} className="ml-auto text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
