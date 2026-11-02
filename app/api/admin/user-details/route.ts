import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Everything an admin needs to see about one account, in one place: the login
// (auth.users), the profile including the private personal details people enter
// at signup (grant-protected, so only the service role can read them), and the
// vendor / promoter records hanging off it. Read-only; edits go through
// /api/admin/edit-user and /api/admin/user-tags.
export async function GET(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });

  const [{ data: au }, { data: profile }] = await Promise.all([
    g.admin.auth.admin.getUserById(id),
    g.admin
      .from("user_profiles")
      .select(
        "id, display_name, username, username_chosen_at, role, bio, home_city, pronouns, website, full_name, phone, address_line1, address_line2, city, region, postal_code, pending_email, created_at, vendor_id, is_vendor, is_marketplace, is_festdash_vendor, is_promoter, is_founder, is_artisan, is_driver, is_forager, is_verified"
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!profile) return NextResponse.json({ error: "No such account." }, { status: 404 });

  const user = au?.user ?? null;
  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : []);

  const [vendor, promoter] = await Promise.all([
    profile.vendor_id
      ? g.admin.from("vendors").select("id, name, status").eq("id", profile.vendor_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    g.admin
      .from("festdash_promoters")
      .select("referral_code, is_active, is_coordinator, region, payout_method")
      .eq("user_id", id)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  return NextResponse.json({
    account: {
      email: user?.email ?? null,
      email_confirmed_at: user?.email_confirmed_at ?? null,
      last_sign_in_at: user?.last_sign_in_at ?? null,
      created_at: user?.created_at ?? null,
      providers,
      auth_phone: user?.phone || null,
    },
    profile,
    vendor,
    promoter,
  });
}
