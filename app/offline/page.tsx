export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
      <div className="max-w-sm text-center">
        <div className="mb-4 text-5xl">📡</div>
        <h1 className="font-bebas text-4xl tracking-wide">You&apos;re offline</h1>
        <p className="mt-3 text-neutral-400">
          NorthEDM needs a connection for this page. Reconnect and try again — recently
          viewed pages may still load.
        </p>
      </div>
    </main>
  );
}
