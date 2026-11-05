"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Edit shop → the "QTY Not Listed?" requests shoppers sent this store
 * (/api/store/[slug]/requests). Open ones first, each with Done / Dismiss.
 * Only a public username and a message link — never an email or address.
 */
type Req = { id: string; product_id: number; item: string; quantity: number; note: string | null; status: string; created_at: string; user_id: string; who: string };

export function ItemRequestsPanel({ slug, accent }: { slug: string; accent: string }) {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/store/${slug}/requests`).then((r) => r.json()).then((j) => setRows((j.requests ?? []) as Req[])).catch(() => setRows([]));
  }, [slug]);

  async function mark(id: string, status: "done" | "dismissed" | "open") {
    setError("");
    const res = await fetch(`/api/store/${slug}/requests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => null);
    if (!res?.ok) { setError("Couldn't update that request."); return; }
    setRows((r) => (r ?? []).map((x) => (x.id === id ? { ...x, status } : x)));
  }

  if (!rows) return null;
  const open = rows.filter((r) => r.status === "open");
  const shown = showAll ? rows : open;
  return (
    <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: open.length ? accent : "rgba(255,255,255,0.15)", background: open.length ? `${accent}14` : undefined }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-white">🛒 Item requests {open.length > 0 && <span className="ml-1 rounded-full px-2 py-0.5 text-xs text-black" style={{ background: accent }}>{open.length} open</span>}</p>
        {rows.length > open.length && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="font-dm-mono text-[11px] text-neutral-400 underline">{showAll ? "Open only" : `Show handled (${rows.length - open.length})`}</button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-400">No open requests. Shoppers ask through &ldquo;Couldn&apos;t find what you were looking for? → request here&rdquo; at the top and bottom of your shop.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/10">
          {shown.map((r) => (
            <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm ${r.status === "open" ? "" : "opacity-50"}`}>
              <span className="font-semibold text-white">{r.quantity} × {r.item}</span>
              <span className="text-neutral-400">from <Link href={`/profile/${r.user_id}`} className="underline hover:text-white">@{r.who}</Link></span>
              <span className="font-dm-mono text-[11px] text-neutral-500">{new Date(r.created_at).toLocaleDateString()}</span>
              {r.note && <span className="basis-full text-neutral-300">&ldquo;{r.note}&rdquo;</span>}
              <span className="ml-auto flex gap-1.5">
                <Link href={`/messages?to=${r.user_id}`} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-neutral-200 hover:bg-white/5">Message</Link>
                {r.status === "open" ? (
                  <>
                    <button type="button" onClick={() => mark(r.id, "done")} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-black" style={{ background: accent }}>Done</button>
                    <button type="button" onClick={() => mark(r.id, "dismissed")} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-neutral-300 hover:bg-white/5">Dismiss</button>
                  </>
                ) : (
                  <button type="button" onClick={() => mark(r.id, "open")} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-neutral-400">Reopen</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-[#FF5C3A]">{error}</p>}
    </div>
  );
}
