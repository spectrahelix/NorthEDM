"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Crumb = { label: string; href: string };

// Reusable contextual navigation for deep/detail pages so users are never
// "locked in" a flow. Renders a real "← Back" (browser history, with a safe
// fallback when the page was opened directly) plus explicit Home + section
// links. Drop it near the top of any detail or dashboard page.
export function BackBar({
  crumbs = [],
  fallback = "/",
}: {
  crumbs?: Crumb[];
  fallback?: string;
}) {
  const router = useRouter();

  function goBack() {
    // If we have history to go back to, use it ("where they came from").
    // Otherwise (direct link / new tab) fall back to a sensible parent.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-dm-mono text-xs">
      <button
        onClick={goBack}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-neutral-300 transition hover:bg-white/5 hover:text-white"
      >
        ← Back
      </button>
      <span className="text-neutral-700">·</span>
      <Link href="/" className="text-neutral-400 transition hover:text-white">
        Home
      </Link>
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-2">
          <span className="text-neutral-700">/</span>
          <Link href={c.href} className="text-neutral-400 transition hover:text-white">
            {c.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
