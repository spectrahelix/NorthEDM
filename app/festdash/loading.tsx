// Instant screen while a FestDash page is built on the server.
//
// Without this, /festdash (rendered per request) is not prefetched and a click
// on "Explore FestDash" sat on the old page until the server finished — on a
// cold start, 2.6s of nothing happening. With it, Next prefetches this
// fallback and swaps it in the moment the link is tapped. Covers the nested
// /festdash/* pages too, so it stays generic: brand, then placeholders.
export default function FestDashLoading() {
  return (
    <main className="min-h-screen" aria-busy="true">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-orange-950/40 to-neutral-950 px-6 py-24 text-center">
        <div className="relative mx-auto max-w-3xl">
          <h1 className="font-bebas text-6xl tracking-wide text-white md:text-8xl">
            Fest<span className="text-orange-400">Dash</span>
          </h1>
          <p className="mt-4 font-dm-mono text-xs uppercase tracking-[0.25em] text-neutral-500">Loading…</p>
          <div className="mx-auto mt-8 flex max-w-md animate-pulse flex-col items-center gap-3">
            <div className="h-4 w-3/4 rounded bg-white/10" />
            <div className="h-4 w-2/3 rounded bg-white/10" />
            <div className="mt-4 flex gap-3">
              <div className="h-12 w-32 rounded-2xl bg-orange-500/30" />
              <div className="h-12 w-32 rounded-2xl bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
