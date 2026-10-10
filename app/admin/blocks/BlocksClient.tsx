"use client";

import { useCallback, useEffect, useState } from "react";

type BlockRow = {
  bucket: string;
  label: string;
  what: string;
  ip: string;
  attempts: number;
  max: number;
  lastAt: string;
  clearsAt: string;
  blocked: boolean;
  who: string | null;
};

function minutesUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const mins = Math.ceil(ms / 60000);
  return mins === 1 ? "about a minute" : `about ${mins} minutes`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.floor(mins / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export function BlocksClient() {
  const [rows, setRows] = useState<BlockRow[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/blocks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load.");
      setRows(json.rows as BlockRow[]);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
    // These expire on their own, so keep the page honest without a reload.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function letThemBackIn(row: BlockRow) {
    setWorking(`${row.bucket}|${row.ip}`);
    setError("");
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: row.bucket, ip: row.ip }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't clear that.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(null);
    }
  }

  if (rows === null) {
    return <p className="text-neutral-500">Checking…</p>;
  }

  const blocked = rows.filter((r) => r.blocked);
  const recent = rows.filter((r) => !r.blocked);

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-xl border border-[#FF5C3A]/30 bg-[#FF5C3A]/10 px-4 py-3 text-sm text-[#FF5C3A]">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-1 font-bebas text-2xl tracking-wide text-white">
          Currently blocked
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          These people are being turned away right now. Every block also expires
          on its own — the button just doesn&apos;t make them wait.
        </p>

        {blocked.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <p className="text-[#39FF14]">Nobody is blocked.</p>
            <p className="mt-1 text-sm text-neutral-500">
              Nothing to do here. This is the normal state.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {blocked.map((r) => (
              <li
                key={`${r.bucket}|${r.ip}`}
                className="rounded-2xl border border-[#FFC93C]/30 bg-[#FFC93C]/[0.06] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bebas text-xl tracking-wide text-white">
                      {r.who ?? "Someone"} — {r.label}
                    </p>
                    <p className="mt-1 text-sm text-neutral-400">{r.what}</p>
                    <p className="mt-2 text-sm text-neutral-400">
                      Tried <span className="text-white">{r.attempts} times</span>{" "}
                      (limit is {r.max}), last {timeAgo(r.lastAt)}.
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Clears by itself in {minutesUntil(r.clearsAt)}.
                    </p>
                    <p className="mt-2 font-dm-mono text-xs text-neutral-600">{r.ip}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => letThemBackIn(r)}
                    disabled={working === `${r.bucket}|${r.ip}`}
                    className="shrink-0 rounded-xl bg-[#39FF14] px-5 py-2.5 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                  >
                    {working === `${r.bucket}|${r.ip}` ? "Clearing…" : "Let them back in"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-bebas text-2xl tracking-wide text-white">
          Recent activity
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          Not blocked — just people who used a form recently. Here so you can see
          the limits working rather than guessing.
        </p>

        {recent.length === 0 ? (
          <p className="text-sm text-neutral-600">Nothing in the last hour.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={`${r.bucket}|${r.ip}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
              >
                <span className="text-neutral-300">
                  {r.who ?? "Someone"} — {r.label}
                </span>
                <span className="text-neutral-500">
                  {r.attempts} of {r.max}, last {timeAgo(r.lastAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-neutral-400">
        <h3 className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          What these limits are
        </h3>
        <ul className="space-y-1.5">
          <li>
            <span className="text-neutral-200">Vendor application</span> — 5 successful
            applications per 10 minutes
          </li>
          <li>
            <span className="text-neutral-200">Account signup</span> — 3 new accounts per
            hour
          </li>
          <li>
            <span className="text-neutral-200">Sign-in help</span> — 4 per hour, and this
            one never blocks anyone; past the limit it only stops emailing you
          </li>
        </ul>
        <p className="mt-3">
          Only submissions that actually went through are counted. Someone hitting an
          error and trying again does not use up their allowance.
        </p>
      </section>
    </div>
  );
}
