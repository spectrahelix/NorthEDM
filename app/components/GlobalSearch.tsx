"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SearchResults = {
  vendors: { id: number; name: string; category: string }[];
  festivals: { id: number; name: string; location: string }[];
  products: { id: number; name: string; category: string }[];
  threads: { id: number; title: string; category: string }[] | null;
};

const QUICK_LINKS = [
  { href: "/crowdwave", label: "Festivals", color: "#3AFFD4" },
  { href: "/marketplace", label: "Marketplace", color: "#39FF14" },
  { href: "/vendors", label: "Vendors", color: "#FF5C3A" },
  { href: "/forum", label: "Forum", color: "#CC00FF", authOnly: true },
];

export function GlobalSearch({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  // Close on navigation
  useEffect(() => { setOpen(false); setQ(""); setResults(null); }, [pathname]);

  // Cmd/Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  function onInput(val: string) {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 250);
  }

  function close() { setOpen(false); }

  const hasAny = results && (
    results.festivals.length > 0 ||
    results.vendors.length > 0 ||
    results.products.length > 0 ||
    (results.threads && results.threads.length > 0)
  );

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-[14vh] bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl">

        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-neutral-600">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => onInput(e.target.value)}
            placeholder="Search festivals, vendors, products, forum…"
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          />
          {loading && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-700 border-t-[#3AFFD4]" />
          )}
          <button onClick={close} className="font-dm-mono text-[10px] text-neutral-700 hover:text-neutral-400">
            ESC
          </button>
        </div>

        {/* Results */}
        {hasAny && (
          <div className="max-h-[55vh] overflow-y-auto border-t border-white/10 pb-2">
            {results!.festivals.length > 0 && (
              <ResultSection label="Festivals" color="#3AFFD4">
                {results!.festivals.map((f) => (
                  <ResultRow key={f.id} href={`/crowdwave/festival/${f.id}`} title={f.name} meta={f.location} onClose={close} />
                ))}
              </ResultSection>
            )}
            {results!.vendors.length > 0 && (
              <ResultSection label="Vendors" color="#FF5C3A">
                {results!.vendors.map((v) => (
                  <ResultRow key={v.id} href="/vendors" title={v.name} meta={v.category} onClose={close} />
                ))}
              </ResultSection>
            )}
            {results!.products.length > 0 && (
              <ResultSection label="Marketplace" color="#39FF14">
                {results!.products.map((p) => (
                  <ResultRow key={p.id} href={`/marketplace/${p.id}`} title={p.name} meta={p.category} onClose={close} />
                ))}
              </ResultSection>
            )}
            {results!.threads && results!.threads.length > 0 && (
              <ResultSection label="Forum" color="#CC00FF">
                {results!.threads.map((t) => (
                  <ResultRow key={t.id} href={`/forum/${t.id}`} title={t.title} meta={t.category} onClose={close} />
                ))}
              </ResultSection>
            )}
          </div>
        )}

        {/* No results */}
        {q.length >= 2 && !loading && !hasAny && results && (
          <div className="border-t border-white/10 py-10 text-center">
            <p className="text-sm text-neutral-600">No results for &ldquo;{q}&rdquo;</p>
          </div>
        )}

        {/* Forum gated notice */}
        {results?.threads === null && q.length >= 2 && (
          <div className="border-t border-white/10 px-5 py-3">
            <p className="font-dm-mono text-[11px] text-neutral-700">
              <Link href="/login" className="text-[#CC00FF] transition hover:underline" onClick={close}>
                Sign in
              </Link>{" "}
              to search forum threads
            </p>
          </div>
        )}

        {/* Quick links when query is empty */}
        {!q && (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="mb-2.5 font-dm-mono text-[9px] uppercase tracking-widest text-neutral-700">
              Quick Links
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.filter((l) => !l.authOnly || userId).map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="rounded-full px-3 py-1 font-dm-mono text-xs transition hover:opacity-80"
                  style={{
                    color: l.color,
                    background: l.color + "18",
                    border: `1px solid ${l.color}35`,
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-500 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-neutral-300"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <span className="hidden rounded border border-white/10 px-1 font-dm-mono text-[9px] text-neutral-700 sm:inline">
          ⌘K
        </span>
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  );
}

function ResultSection({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-2 pt-3">
      <p
        className="mb-0.5 px-3 font-dm-mono text-[9px] uppercase tracking-widest"
        style={{ color }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function ResultRow({
  href,
  title,
  meta,
  onClose,
}: {
  href: string;
  title: string;
  meta: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/[0.06]"
    >
      <span className="min-w-0 truncate text-sm text-neutral-200">{title}</span>
      <span className="ml-3 shrink-0 font-dm-mono text-[10px] text-neutral-600">{meta}</span>
    </Link>
  );
}
