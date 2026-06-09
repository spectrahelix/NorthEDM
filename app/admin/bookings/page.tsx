import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "archon" ||
    profile?.role === "warden" ||
    user.email === ADMIN_EMAIL;

  if (!isAdmin) redirect("/");

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Admin
        </p>
        <h1 className="mt-3 text-5xl font-semibold">Booking Requests</h1>
        <p className="mt-4 max-w-2xl text-neutral-300">
          View incoming mushroom foraging inquiries submitted through NorthEDM.
        </p>

        <div className="mt-6 text-sm text-neutral-400">
          Signed in as: {user.email}
        </div>

        {error ? (
          <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            Failed to load bookings: {error.message}
          </div>
        ) : null}

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-neutral-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Group Size</th>
                <th className="px-4 py-3">Preferred Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {bookings && bookings.length > 0 ? (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-white/5 align-top">
                    <td className="px-4 py-4">{booking.name}</td>
                    <td className="px-4 py-4">{booking.email}</td>
                    <td className="px-4 py-4">{booking.group_size}</td>
                    <td className="px-4 py-4">{booking.preferred_date}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                        {booking.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{booking.notes || "—"}</td>
                    <td className="px-4 py-4">
                      {new Date(booking.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-neutral-400" colSpan={7}>
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
