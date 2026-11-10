// Let every section show a prefetched loading screen while its server data
// arrives. Without this boundary, a bubble click leaves the previous page
// unchanged until the destination finishes rendering, which looks unresponsive.
export default function PageLoading() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-6 py-14" aria-busy="true">
      <div role="status" className="flex items-center gap-3 text-[#3AFFD4]">
        <span
          aria-hidden="true"
          className="h-5 w-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
        <p className="font-dm-mono text-sm uppercase tracking-widest">Loading page…</p>
      </div>
      <div aria-hidden="true" className="mt-8 space-y-6 motion-safe:animate-pulse">
        <div className="h-12 w-2/3 max-w-md rounded-xl bg-white/10" />
        <div className="h-4 w-full max-w-xl rounded bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-3xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </main>
  );
}
