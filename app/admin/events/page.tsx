import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { EventActions, RefreshButton } from "./EventActions";

export const metadata = { title: "Admin · Local Events" };

type LocalEvent = {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  source: string;
  source_url: string | null;
  status: string;
};

function fmtRange(start: string | null, end: string | null) {
  if (!start) return "Date TBA";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-US", opts);
  if (!end || end === start) return s;
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-[#39FF14]/10 text-[#39FF14]",
  pending: "bg-[#E8FF47]/10 text-[#E8FF47]",
  hidden: "bg-white/5 text-neutral-500",
};

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin = me?.role === "archon" || me?.role === "warden" || user.email === "cjblue27@gmail.com";
  if (!isAdmin) redirect("/");

  // Admin needs to see pending/hidden too. RLS only exposes approved rows to
  // the anon client, so read the full set through the service-role client.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await admin
    .from("local_events")
    .select("*")
    .order("start_date", { ascending: true, nullsFirst: false });
  const events = (data ?? []) as LocalEvent[];

  const pending = events.filter((e) => e.status === "pending");
  const approved = events.filter((e) => e.status === "approved");
  const hidden = events.filter((e) => e.status === "hidden");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#00D4FF]">Admin · Local Events</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Upcoming Local Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Auto-collected from a curated seed list of regional festivals plus optional Ticketmaster
          discovery. Curated events auto-approve; discovered events wait here for your review before
          appearing on the public <span className="text-neutral-300">/events</span> page.
        </p>

        <div className="mt-6">
          <RefreshButton />
        </div>

        <Section title={`Pending review (${pending.length})`} events={pending} showActions />
        <Section title={`Approved — live on /events (${approved.length})`} events={approved} showActions />
        {hidden.length > 0 && <Section title={`Hidden (${hidden.length})`} events={hidden} showActions />}
      </div>
    </main>
  );
}

function Section({ title, events, showActions }: { title: string; events: LocalEvent[]; showActions?: boolean }) {
  return (
    <>
      <h2 className="mt-10 mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{title}</h2>
      {events.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-neutral-500">
          Nothing here.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bebas text-xl tracking-wide text-white">{e.name}</p>
                    <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${STATUS_STYLE[e.status] ?? ""}`}>
                      {e.status}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      {e.source}
                    </span>
                  </div>
                  <p className="mt-1 font-dm-mono text-xs text-neutral-500">
                    {fmtRange(e.start_date, e.end_date)}
                    {(e.venue || e.city) ? " · " : ""}
                    {[e.venue, e.city, e.region].filter(Boolean).join(", ")}
                  </p>
                  {e.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-400">{e.description}</p>}
                  {e.source_url && (
                    <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-dm-mono text-xs text-[#00D4FF] hover:underline">
                      source ↗
                    </a>
                  )}
                </div>
                {showActions && <EventActions id={e.id} status={e.status} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
