import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminRequestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  const { data: requests, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">
          Admin
        </p>
        <h1 className="mt-3 text-5xl font-semibold">Service Requests</h1>
        <p className="mt-4 max-w-2xl text-neutral-300">
          Review incoming work and service requests submitted through NorthEDM.
        </p>

        <div className="mt-6 text-sm text-neutral-400">
          Signed in as: {user.email}
        </div>

        {error ? (
          <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            Failed to load requests: {error.message}
          </div>
        ) : null}

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-neutral-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Service Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests && requests.length > 0 ? (
                requests.map((request) => (
                  <tr key={request.id} className="border-b border-white/5 align-top">
                    <td className="px-4 py-4">{request.name}</td>
                    <td className="px-4 py-4">{request.email}</td>
                    <td className="px-4 py-4">{request.service_type}</td>
                    <td className="px-4 py-4">{request.description}</td>
                    <td className="px-4 py-4">{request.urgency || "—"}</td>
                    <td className="px-4 py-4">{request.budget || "—"}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                        {request.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {new Date(request.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-neutral-400" colSpan={8}>
                    No requests yet.
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
