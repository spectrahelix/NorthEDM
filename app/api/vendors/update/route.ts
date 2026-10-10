import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// Admin actions on a vendor record: approve/reject, change listing, suspend.
//
// Approving used to set a status and nothing else, which meant an "approved"
// vendor still had no dashboard and no inventory. Everything a vendor can
// actually DO hangs off user_profiles.vendor_id, and nothing in the codebase
// ever wrote it — 6 approved vendors, 2 linked, and those two done by hand in
// SQL. Approving now grants access for real, and says so when it can't.

type GrantResult = { linked: boolean; note: string };

/**
 * Connect a vendor record to the account that applied for it.
 *
 * The application form is open to people who are not signed in, so all we have
 * is the email they typed. Match it to an account, then set both halves of the
 * link: vendors.user_id (who owns this record) and user_profiles.vendor_id
 * (which record this person manages). The dashboards read the second one.
 */
async function grantVendorAccess(admin: SupabaseClient, vendorId: number): Promise<GrantResult> {
  const { data: vendor } = await admin
    .from("vendors")
    .select("id, email, user_id")
    .eq("id", vendorId)
    .maybeSingle();

  if (!vendor) return { linked: false, note: "Vendor record not found." };

  let userId: string | null = (vendor.user_id as string | null) ?? null;

  if (!userId) {
    if (!vendor.email) {
      return { linked: false, note: "No email on this application, so there is nobody to link it to." };
    }
    const { data: found, error } = await admin.rpc("user_id_for_email", { p_email: vendor.email });
    if (error) return { linked: false, note: `Couldn't look up that email: ${error.message}` };
    userId = (found as string | null) ?? null;
  }

  if (!userId) {
    // The common, recoverable case: they applied before making an account.
    // Say so plainly rather than approving into a dead end.
    return {
      linked: false,
      note: `No account found for ${vendor.email}. Ask them to sign up with that exact address, then press Approve again to give them their dashboard.`,
    };
  }

  const [{ error: vErr }, { error: pErr }] = await Promise.all([
    admin.from("vendors").update({ user_id: userId }).eq("id", vendorId),
    admin.from("user_profiles").update({ vendor_id: vendorId, is_vendor: true }).eq("id", userId),
  ]);

  if (vErr || pErr) {
    return { linked: false, note: `Couldn't grant access: ${(vErr ?? pErr)?.message}` };
  }
  return { linked: true, note: "They can now sign in and manage their inventory." };
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ success: false, error: g.error }, { status: g.status });

  const data = (await req.json().catch(() => ({}))) as {
    id?: number;
    status?: string;
    vendorType?: string;
    isPublic?: boolean;
    action?: "suspend" | "unsuspend";
    reason?: string;
  };

  if (!data.id) {
    return NextResponse.json({ success: false, error: "Missing vendor id" }, { status: 400 });
  }

  // ── Suspend / restore ────────────────────────────────────────────────────
  // Separate from is_public on purpose: a suspension must not overwrite what
  // they are listed as, or restoring them after payment becomes a guess.
  if (data.action === "suspend" || data.action === "unsuspend") {
    const suspending = data.action === "suspend";
    const { error } = await g.admin
      .from("vendors")
      .update({
        suspended_at: suspending ? new Date().toISOString() : null,
        suspended_reason: suspending ? (data.reason?.trim() || "Unpaid invoice") : null,
      })
      .eq("id", data.id);

    if (error) {
      console.error("VENDOR SUSPEND ERROR:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      note: suspending
        ? "Hidden from public view. Their listing settings are untouched, so restoring puts them back exactly as they were."
        : "Back in public view, exactly as they were set before.",
    });
  }

  // ── Approve / reject / change listing ────────────────────────────────────
  const { error } = await g.admin
    .from("vendors")
    .update({
      status: data.status,
      vendor_type: data.vendorType,
      is_public: data.isPublic,
    })
    .eq("id", data.id);

  if (error) {
    console.error("VENDOR UPDATE ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Approving is the moment access is granted. Rejecting takes it away.
  if (data.status === "approved") {
    const grant = await grantVendorAccess(g.admin, data.id);
    return NextResponse.json({ success: true, linked: grant.linked, note: grant.note });
  }

  const { data: vendorRow } = await g.admin
    .from("vendors").select("user_id").eq("id", data.id).maybeSingle();
  if (vendorRow?.user_id) {
    await g.admin
      .from("user_profiles")
      .update({ is_vendor: false, vendor_id: null })
      .eq("id", vendorRow.user_id as string);
  }

  return NextResponse.json({ success: true });
}
