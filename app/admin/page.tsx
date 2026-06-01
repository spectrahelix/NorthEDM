import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Admin
        </p>
        <h1 className="mt-3 text-5xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-neutral-300">
          Manage bookings, service requests, and vendors.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Link
            href="/admin/bookings"
            className="rounded-3xl border border-white/10 p-6 hover:bg-white/5"
          >
            <h2 className="text-xl font-medium">Bookings</h2>
            <p className="mt-2 text-sm text-neutral-400">
              View foraging bookings
            </p>
          </Link>

          <Link
            href="/admin/requests"
            className="rounded-3xl border border-white/10 p-6 hover:bg-white/5"
          >
            <h2 className="text-xl font-medium">Requests</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Review service requests
            </p>
          </Link>

          <Link
            href="/admin/vendors"
            className="rounded-3xl border border-white/10 p-6 hover:bg-white/5"
          >
            <h2 className="text-xl font-medium">Vendors</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Manage vendors
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
