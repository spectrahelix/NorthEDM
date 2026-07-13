import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PayButtons } from "./PayButtons";

export const metadata = { title: "Your NorthEDM Quote" };
export const dynamic = "force-dynamic";

type LineItem = { label: string; amount_cents: number };

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: q } = await admin
    .from("service_quotes")
    .select("token, title, client_name, line_items, total_cents, deposit_cents, monthly_cents, amount_paid_cents, status")
    .eq("token", token)
    .maybeSingle();

  if (!q) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
        <div className="text-center">
          <h1 className="font-bebas text-3xl tracking-wide">Quote not found</h1>
          <p className="mt-2 text-neutral-400">This link may be expired. Check with NorthEDM.</p>
          <Link href="/" className="mt-4 inline-block text-[#39FF14] hover:underline">NorthEDM home</Link>
        </div>
      </main>
    );
  }

  const items = (q.line_items ?? []) as LineItem[];
  const paidInFull = q.status === "paid";
  const remaining = q.total_cents - q.amount_paid_cents;
  const hasDeposit = q.deposit_cents > 0 && q.amount_paid_cents === 0;

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-lg">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">NorthEDM · Quote</p>
        <h1 className="mt-3 font-bebas text-5xl leading-none tracking-wide">{q.title}</h1>
        {q.client_name ? <p className="mt-2 text-neutral-400">Prepared for {q.client_name}</p> : null}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="divide-y divide-white/8">
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-neutral-300">{it.label}</span>
                <span className="font-dm-mono text-sm text-neutral-200">{money(it.amount_cents)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-bebas text-3xl text-[#39FF14]">{money(q.total_cents)}</span>
          </div>
          {q.monthly_cents > 0 ? (
            <p className="mt-2 text-right font-dm-mono text-[11px] text-neutral-500">
              + {money(q.monthly_cents)}/mo maintenance &amp; promo package (billed separately)
            </p>
          ) : null}
        </div>

        {paidInFull ? (
          <div className="mt-6 rounded-2xl border border-[#39FF14]/25 bg-[#39FF14]/[0.06] p-6 text-center">
            <div className="text-3xl">✅</div>
            <p className="mt-2 font-semibold text-white">Paid in full — thank you!</p>
            <p className="mt-1 text-sm text-neutral-400">We&apos;ll be in touch to kick things off.</p>
          </div>
        ) : (
          <>
            {q.amount_paid_cents > 0 && (
              <p className="mt-4 text-center font-dm-mono text-xs text-neutral-400">
                {money(q.amount_paid_cents)} paid · {money(remaining)} remaining
              </p>
            )}
            <PayButtons
              token={q.token}
              hasDeposit={hasDeposit}
              depositLabel={`Pay ${money(q.deposit_cents)} deposit`}
              fullLabel={hasDeposit ? `Pay in full — ${money(remaining)}` : `Pay ${money(remaining)}`}
            />
          </>
        )}
      </div>
    </main>
  );
}
