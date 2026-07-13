import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { SetHoodieCookie } from "./SetHoodieCookie";

export const metadata = { title: "Promoter Hoodie" };
export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function HoodieScanPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const db = admin();

  const { data: hoodie } = await db
    .from("promoter_hoodies")
    .select("id, code, promoter_user_id, percent_off, active, scans")
    .eq("code", code)
    .maybeSingle();

  if (!hoodie || !hoodie.active) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">👕</div>
          <h1 className="mb-2 font-bebas text-3xl tracking-wide">Hoodie not recognized</h1>
          <p className="text-neutral-400">This code isn&apos;t active. Double-check the scan, or explore the shop.</p>
          <Link href="/shop" className="mt-6 inline-block rounded-xl bg-[#39FF14] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90">
            Browse the Shop
          </Link>
        </div>
      </main>
    );
  }

  // Count the scan (best-effort).
  await db.from("promoter_hoodies").update({ scans: (hoodie.scans ?? 0) + 1 }).eq("id", hoodie.id);

  // Promoter display name.
  const { data: prof } = await db
    .from("user_profiles")
    .select("display_name")
    .eq("id", hoodie.promoter_user_id)
    .maybeSingle();
  const promoterName = prof?.display_name || "a NorthEDM promoter";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
      <SetHoodieCookie code={hoodie.code} />
      <div className="w-full max-w-md rounded-[2rem] border border-[#CC00FF]/25 bg-[#CC00FF]/[0.04] p-8 text-center">
        <div className="mb-3 text-5xl">👕✨</div>
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#CC00FF]">
          Promoter Hoodie
        </p>
        <h1 className="mt-3 font-bebas text-4xl tracking-wide">
          You&apos;re repping {promoterName}
        </h1>
        <p className="mt-4 text-neutral-300">
          This hoodie unlocks <span className="font-semibold text-[#39FF14]">{hoodie.percent_off}% off</span>{" "}
          your NorthEDM order — and the same amount goes straight to{" "}
          {promoterName} as thanks for the shout-out.
        </p>
        <p className="mt-2 font-dm-mono text-xs text-neutral-500">
          Your discount is now saved — it applies automatically at checkout.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block w-full rounded-2xl bg-[#39FF14] px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Shop with {hoodie.percent_off}% off →
        </Link>
        <Link
          href="/"
          className="mt-3 inline-block font-dm-mono text-xs uppercase tracking-widest text-neutral-500 transition hover:text-neutral-300"
        >
          Explore NorthEDM
        </Link>
      </div>
    </main>
  );
}
