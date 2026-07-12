import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canManageInventory } from "@/utils/marketplace";
import { verifySquare, runSquareSync, type SquareEnv } from "@/utils/square";

// Connect a vendor's Square account: validate the token, store the connection
// (service-role only — the token never touches the browser), then run an
// initial sync so their menu populates immediately.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("vendor_id").eq("id", user.id).single();
  const vendorId = prof?.vendor_id as number | undefined;
  if (!vendorId) return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  if (!(await canManageInventory(supabase, user))) {
    return NextResponse.json({ error: "Marketplace access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const environment: SquareEnv = body.environment === "production" ? "production" : "sandbox";
  let locationId = String(body.locationId || "").trim();
  if (!token) return NextResponse.json({ error: "A Square access token is required." }, { status: 400 });

  // Validate the token and (if given) the location.
  const check = await verifySquare(environment, token);
  if (!check.ok) {
    return NextResponse.json({ error: `Square rejected the token: ${check.error}` }, { status: 400 });
  }
  if (!locationId) {
    if (check.locations.length === 1) locationId = check.locations[0].id;
    else return NextResponse.json(
      { error: "Enter a Location ID.", locations: check.locations },
      { status: 400 }
    );
  } else if (!check.locations.some((l) => l.id === locationId)) {
    return NextResponse.json(
      { error: "That Location ID isn't on this Square account.", locations: check.locations },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: upErr } = await admin
    .from("vendor_square_connections")
    .upsert(
      {
        vendor_id: vendorId,
        access_token: token,
        location_id: locationId,
        environment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vendor_id" }
    );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Initial sync (best-effort — connection is saved regardless).
  try {
    const result = await runSquareSync(admin, {
      vendor_id: vendorId,
      access_token: token,
      location_id: locationId,
      environment,
    });
    return NextResponse.json({ ok: true, environment, locationId, sync: result });
  } catch (e) {
    console.error("square initial sync error:", e);
    return NextResponse.json({ ok: true, environment, locationId, sync: null, syncError: "Connected, but the first sync failed — try Sync now." });
  }
}
