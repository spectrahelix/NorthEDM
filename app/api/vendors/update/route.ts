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
 * Connect a vendor record to the account that runs it.
 *
 * Sets both halves of the link: vendors.user_id (who owns this record) and
 * user_profiles.vendor_id (which record this person manages). The dashboards
 * read the second one.
 *
 * Which account, in order:
 *   1. `toEmail` — the admin typed an address into "Link to account". This is
 *      for when the application email isn't the login email, which is exactly
 *      what happened with the first real vendor: he applied with a business
 *      address and signs in with a personal one.
 *   2. vendors.user_id — they applied while signed in, so we already know.
 *   3. vendors.email — the personal email on the application.
 */
async function grantVendorAccess(
  admin: SupabaseClient,
  vendorId: number,
  toEmail?: string
): Promise<GrantResult> {
  const { data: vendor } = await admin
    .from("vendors")
    .select("id, email, user_id")
    .eq("id", vendorId)
    .maybeSingle();

  if (!vendor) return { linked: false, note: "Vendor record not found." };

  const previousOwner = (vendor.user_id as string | null) ?? null;
  const lookupEmail = toEmail?.trim() || null;
  let userId: string | null = lookupEmail ? null : previousOwner;

  if (!userId) {
    const email = lookupEmail ?? (vendor.email as string | null);
    if (!email) {
      return { linked: false, note: "No email on this application, so there is nobody to link it to. Use “Link to account” and type theirs." };
    }
    const { data: found, error } = await admin.rpc("user_id_for_email", { p_email: email });
    if (error) return { linked: false, note: `Couldn't look up that email: ${error.message}` };
    userId = (found as string | null) ?? null;
    if (!userId) {
      // Recoverable, and the admin is the one who can recover it — say how.
      return {
        linked: false,
        note: lookupEmail
          ? `No NorthEDM account uses ${email}. Check the spelling, or ask them which email they sign in with.`
          : `No account found for ${email}. If they sign in with a different email, open this vendor and use “Link to account” with that one. Otherwise ask them to sign up with ${email} and press Approve again.`,
      };
    }
  }

  // Relinking to someone else: release the previous account first, or both
  // people would keep this vendor's dashboard. Only clear it if it still
  // points here — never touch a link the old owner has to another vendor.
  if (previousOwner && previousOwner !== userId) {
    await admin
      .from("user_profiles")
      .update({ vendor_id: null, is_vendor: false })
      .eq("id", previousOwner)
      .eq("vendor_id", vendorId);
  }

  // One account manages one vendor (user_profiles.vendor_id holds a single
  // id). If this person already ran a different one, say so rather than
  // silently moving them.
  const { data: prof } = await admin
    .from("user_profiles").select("vendor_id").eq("id", userId).maybeSingle();
  const movedFrom =
    prof?.vendor_id && prof.vendor_id !== vendorId ? (prof.vendor_id as number) : null;

  const [{ error: vErr }, { error: pErr }] = await Promise.all([
    admin.from("vendors").update({ user_id: userId }).eq("id", vendorId),
    admin.from("user_profiles").update({ vendor_id: vendorId, is_vendor: true }).eq("id", userId),
  ]);

  if (vErr || pErr) {
    return { linked: false, note: `Couldn't grant access: ${(vErr ?? pErr)?.message}` };
  }

  const who = lookupEmail ?? (vendor.email as string | null) ?? "that account";
  return {
    linked: true,
    note:
      `Linked to ${who}. They can now sign in and manage this vendor's inventory.` +
      (movedFrom ? ` (That account previously managed vendor #${movedFrom}; it now manages this one instead.)` : ""),
  };
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ success: false, error: g.error }, { status: g.status });

  const data = (await req.json().catch(() => ({}))) as {
    id?: number;
    status?: string;
    vendorType?: string;
    isPublic?: boolean;
    action?: "suspend" | "unsuspend" | "link";
    reason?: string;
    email?: string;
  };

  if (!data.id) {
    return NextResponse.json({ success: false, error: "Missing vendor id" }, { status: 400 });
  }

  // ── Link to a specific account ───────────────────────────────────────────
  // For when the email on the application isn't the one they sign in with.
  if (data.action === "link") {
    if (!data.email?.trim()) {
      return NextResponse.json({ success: false, error: "Type the email they sign in with." }, { status: 400 });
    }
    const grant = await grantVendorAccess(g.admin, data.id, data.email);
    return NextResponse.json({ success: grant.linked, linked: grant.linked, note: grant.note, error: grant.linked ? undefined : grant.note });
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
