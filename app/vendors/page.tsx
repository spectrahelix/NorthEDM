import Link from "next/link";

export default function VendorsPage() {
  return (
    <main className="min-h-screen text-neutral-100">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Vendors
        </p>

        <h1 className="mt-3 text-5xl font-semibold">
          Join the NorthEDM Marketplace
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
          NorthEDM is building a network of creators, suppliers, and service
          providers across the Northeast. Whether you're a small producer,
          artist, or specialized supplier, you can plug into the ecosystem.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Private Supplier</h2>
            <p className="mt-3 text-sm text-neutral-300">
              Work behind the scenes supplying goods or materials to a limited
              number of clients.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Listed Vendor</h2>
            <p className="mt-3 text-sm text-neutral-300">
              Publicly visible on the platform with products and offerings
              available to customers.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Featured Vendor</h2>
            <p className="mt-3 text-sm text-neutral-300">
              Highlighted partners with priority placement and increased
              visibility across the platform.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/vendors/apply"
            className="rounded-2xl bg-green-400 px-6 py-3 font-medium text-black"
          >
            Apply as a Vendor
          </Link>

          <Link
            href="/marketplace"
            className="rounded-2xl border border-white/15 px-6 py-3 font-medium text-white"
          >
            View Marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}