import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { RequestCard, type Reply, type ServiceRequest } from "./RequestCard";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminRequestsPage() {
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

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });
  const requests = (data ?? []) as ServiceRequest[];

  // Reply history is admin-only (service role), so it is read here after the
  // admin check above rather than from the browser.
  const svc = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: replyRows } = await svc
    .from("request_replies")
    .select("id, request_id, body, sent_to, delivered, created_at")
    .order("created_at", { ascending: true });
  const repliesFor = new Map<number, Reply[]>();
  for (const r of (replyRows ?? []) as Reply[]) {
    repliesFor.set(r.request_id, [...(repliesFor.get(r.request_id) ?? []), r]);
  }

  // What needs a decision first; everything else after.
  const open = requests.filter((r) => (r.status ?? "pending") === "pending");
  const rest = requests.filter((r) => (r.status ?? "pending") !== "pending");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.3em] text-green-300">Admin</p>
        <h1 className="mt-3 text-5xl font-semibold">Service Requests</h1>
        <p className="mt-4 max-w-2xl text-neutral-300">
          Review, reply to, and track service requests submitted through NorthEDM.
        </p>

        {error ? (
          <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
            Failed to load requests: {error.message}
          </div>
        ) : null}

        <h2 className="mb-3 mt-10 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Needs a decision ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-neutral-500">
            Nothing waiting on you.
          </p>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <RequestCard key={r.id} request={r} replies={repliesFor.get(r.id) ?? []} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <>
            <h2 className="mb-3 mt-10 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Everything else ({rest.length})
            </h2>
            <div className="space-y-3">
              {rest.map((r) => (
                <RequestCard key={r.id} request={r} replies={repliesFor.get(r.id) ?? []} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
