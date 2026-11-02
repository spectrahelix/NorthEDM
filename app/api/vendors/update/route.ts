import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { coordinatorFor, enrollCoordinatorShop, loadSplitSettings } from "@/utils/coordinator";
import { isLocalRail } from "@/utils/gambiaPay";
import { formatMoney } from "@/utils/money";
import { BRAND, emailUser, notifyUserInApp, userEmailById, type EmailRow } from "@/utils/notifyEmail";
import { notifyNewApplication } from "@/utils/alerts";
import { vendorApplicationFields, type VendorApplicationRow } from "@/utils/vendorApplication";

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

/**
 * Approval used to be silent: the applicant found out by revisiting the site,
 * and a coordinator shop's purse keeper was never told a shop was waiting on
 * its first fee. Now the applicant gets an email with their next step and, for
 * a coordinator shop, the coordinator gets an email + in-app alert to collect
 * and log the fee. Best-effort: a mail failure is reported in the admin note,
 * never allowed to undo the approval.
 */
async function sendApprovalMessages(admin: SupabaseClient, vendorId: number): Promise<string> {
  const { data: v } = await admin
    .from("vendors")
    .select("id, name, email, business_email, user_id, coordinator_user_id, currency, area, whatsapp_number")
    .eq("id", vendorId)
    .maybeSingle();
  if (!v) return "";
  const to = v.email || v.business_email || (await userEmailById(admin, v.user_id));
  const shopName = v.name ?? "Your shop";
  const notes: string[] = [];

  if (isLocalRail(v) && v.coordinator_user_id) {
    const purse = await coordinatorFor(admin, v.coordinator_user_id);
    const settings = await loadSplitSettings(admin);
    const coordName = purse?.display_name ?? "your coordinator";
    const fee = formatMoney(settings.subscription_fee_cents, "USD");
    const wallets: EmailRow[] = [
      ["Coordinator", coordName],
      ["Wave", purse?.wave_number],
      ["QMoney", purse?.qmoney_number],
      ["Afrimoney", purse?.afrimoney_number],
      ["WhatsApp", purse?.whatsapp_number],
    ];
    const r = await emailUser(to, `${shopName} is approved — one step to go live`, {
      heading: `${shopName} is approved`,
      intro: `One step left before customers can see you: the first month's listing fee of ${fee}, paid in your local currency to ${coordName}. Send it to one of the wallets below with your shop name as the reference, or ${coordName} will come by to collect it. As soon as it is logged, your shop appears on FestDash.`,
      rows: wallets,
      cta: { label: "See your shop's status", path: "/festdash/shop-setup" },
      outro: "Add your items and prices now in your vendor dashboard so you're ready the moment you go live. Transfer times depend on each payment app, not on FestDash.",
    });
    notes.push(r.ok ? ` Emailed the shop the fee step.` : ` Couldn't email the shop (${r.error}).`);

    const shopLine = `${shopName}${v.area ? ` in ${v.area}` : ""}${v.whatsapp_number ? ` · WhatsApp ${v.whatsapp_number}` : ""}`;
    const coordEmail = await userEmailById(admin, v.coordinator_user_id);
    const c = await emailUser(coordEmail, `${shopName} is approved — collect the first fee`, {
      heading: "A shop is waiting on its first fee",
      intro: `${shopLine} was approved and is enrolled on FestDash under your code. It stays hidden until you collect the first month's fee (${fee}) and log it in your purse console.`,
      rows: [["Shop", shopName], ["Area", v.area], ["WhatsApp", v.whatsapp_number]],
      cta: { label: "Open the purse console", path: "/festdash/purse" },
    });
    await notifyUserInApp(admin, v.coordinator_user_id, "coordinator_shop_approved", `${shopLine} is approved — collect and log its first fee to switch it on.`, "/festdash/purse");
    notes.push(c.ok ? ` Alerted ${coordName}.` : ` Couldn't email the coordinator (${c.error}).`);
  } else {
    const r = await emailUser(to, `You're approved on ${BRAND}`, {
      heading: `${shopName} is approved`,
      intro: "Your vendor application has been approved. Sign in to add your items, photos and prices. If you plan to take FestDash orders, set up payouts from your FestDash vendor dashboard so each delivered order is paid straight to you.",
      cta: { label: "Open your vendor dashboard", path: "/vendor/dashboard" },
    });
    notes.push(r.ok ? ` Emailed the applicant.` : to ? ` Couldn't email the applicant (${r.error}).` : " No email on the application, so nothing was sent.");
  }
  await notifyUserInApp(admin, v.user_id, "vendor_approved", `${shopName} is approved.`, isLocalRail(v) ? "/festdash/shop-setup" : "/vendor/dashboard");
  return notes.join("");
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ success: false, error: g.error }, { status: g.status });

  const data = (await req.json().catch(() => ({}))) as {
    id?: number;
    status?: string;
    vendorType?: string;
    isPublic?: boolean;
    action?: "suspend" | "unsuspend" | "link" | "resend_alert";
    reason?: string;
    email?: string;
  };

  if (!data.id) {
    return NextResponse.json({ success: false, error: "Missing vendor id" }, { status: 400 });
  }

  // ── Email me this application ────────────────────────────────────────────
  // Re-sends the owner alert with the whole application, for one that was
  // missed or arrived before alerts carried the details.
  if (data.action === "resend_alert") {
    const { data: v } = await g.admin.from("vendors").select("*").eq("id", data.id).maybeSingle();
    if (!v) return NextResponse.json({ success: false, error: "No such vendor." }, { status: 404 });
    const row = v as VendorApplicationRow & { coordinator_user_id: string | null };
    let coordinatorName: string | null = null;
    if (row.coordinator_user_id) {
      const { data: p } = await g.admin.from("festdash_promoters").select("display_name").eq("user_id", row.coordinator_user_id).maybeSingle();
      coordinatorName = p?.display_name ?? null;
    }
    await notifyNewApplication({
      kind: row.coordinator_user_id || row.coordinator_code ? "shop" : "marketplace",
      name: row.name ?? `Vendor #${data.id}`,
      email: row.email ?? row.business_email ?? "no email",
      reviewPath: `/admin/vendors#vendor-${data.id}`,
      fields: vendorApplicationFields(row, coordinatorName),
    });
    return NextResponse.json({ success: true, note: "Sent the full application to your alert email." });
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
    const enrolled = await enrollCoordinatorShop(g.admin, data.id);
    const mailNote = await sendApprovalMessages(g.admin, data.id);
    return NextResponse.json({
      success: true, linked: grant.linked, enrolled,
      note: grant.note + (enrolled ? " Enrolled on FestDash — live once their coordinator logs the first month's fee." : "") + mailNote,
    });
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
