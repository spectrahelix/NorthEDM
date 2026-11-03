import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { isLocalRail } from "@/utils/gambiaPay";
import { paidLocalVendorIds } from "@/utils/coordinator";
import { festdashListingActive } from "@/utils/billing";

type V = {
  id: number; name: string; category: string; description: string;
  coordinator_user_id: string | null; region: string | null; currency: string | null; whatsapp_number: string | null;
};

// Public list of vendors taking FestDash orders. RLS on festdash_vendors and
// vendors keeps hidden ("lights out") vendors out — that read stays on the
// visitor's own client on purpose. Shops on the local rail (a coordinator AND a
// non-USD currency — isLocalRail) are listed only while their monthly fee is
// current, and carry their purse keeper's wallet numbers so checkout can say
// where to pay. A USD vendor with a coordinator is an ordinary card vendor here.
export async function GET() {
  const supabase = await createClient();
  const { data: fdVendors, error } = await supabase
    .from("festdash_vendors")
    .select("vendor_id, vendors(id, name, category, description, coordinator_user_id, region, currency, whatsapp_number)")
    .eq("is_active", true);
  if (error) return NextResponse.json({ vendors: [], error: error.message }, { status: 500 });

  const base = (fdVendors ?? [])
    .map((r) => (r as { vendors: unknown }).vendors as V | null)
    .filter((v): v is V => !!v);

  const local = base.filter((v) => isLocalRail(v));
  const admin = serviceClient();
  // Card-rail vendors are listed only while their monthly FestDash listing
  // (Stripe subscription) is active — the US counterpart of the wallet-rail fee gate.
  const cardIds = base.filter((v) => !isLocalRail(v)).map((v) => v.id);
  const listed = await festdashListingActive(admin, cardIds);
  if (local.length === 0) return NextResponse.json({ vendors: base.filter((v) => listed.has(v.id)), fallback: false });

  const today = new Date().toISOString().slice(0, 10);
  const coordIds = [...new Set(local.map((v) => v.coordinator_user_id as string))];
  const [{ data: subs }, { data: purses }] = await Promise.all([
    paidLocalVendorIds(admin, local.map((v) => v.id)).then((set) => ({ data: [...set].map((vendor_id) => ({ vendor_id })) })),
    admin.from("festdash_promoters")
      .select("user_id, wave_number, qmoney_number, afrimoney_number, whatsapp_number")
      .in("user_id", coordIds).eq("is_coordinator", true),
  ]);
  const paid = new Set((subs ?? []).map((s) => Number(s.vendor_id)));
  const purseBy = new Map((purses ?? []).map((p) => [p.user_id as string, p]));

  const vendors = base
    .filter((v) => (isLocalRail(v) ? paid.has(v.id) : listed.has(v.id)))
    .map((v) => {
      if (!isLocalRail(v) || !v.coordinator_user_id) return v;
      const p = purseBy.get(v.coordinator_user_id);
      return {
        ...v,
        payments: {
          wave: p?.wave_number ?? null,
          qmoney: p?.qmoney_number ?? null,
          afrimoney: p?.afrimoney_number ?? null,
          whatsapp: v.whatsapp_number || p?.whatsapp_number || null,
        },
      };
    });
  return NextResponse.json({ vendors, fallback: false });
}
