import { NextResponse } from "next/server";
import { notifyNewApplication } from "@/utils/alerts";
import { vendorApplicationFields } from "@/utils/vendorApplication";
import { createClient } from "@/utils/supabase/server";
import { clientIp, clientContradictsItself, overRateLimit, recordAttempt } from "@/utils/botSignals";

import { createClient as createAdminClient } from "@supabase/supabase-js";
// Per-IP throttle. This was an in-memory Map, which on serverless is close to
// useless — it dies on every cold start and each instance keeps its own copy,
// so a caller spread across instances is never counted. It now shares the
// durable counter in public.request_throttle with the other guest-open routes.
const RATE_LIMIT = 5; // successful submissions
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes

// A successful-looking response we hand to bots so they don't retry or learn.
const SILENT_OK = NextResponse.json({
  success: true,
  message: "Application submitted successfully.",
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const data = await req.json();

    // 1) Honeypot — humans never fill the hidden field; bots do.
    if (typeof data.company_website === "string" && data.company_website.trim() !== "") {
      return SILENT_OK;
    }

    // 2) Timing trap — real users take more than a few seconds to fill the form.
    if (typeof data.elapsedMs === "number" && data.elapsedMs < 3000) {
      return SILENT_OK;
    }

    // 3) A client whose user-agent claims Chromium but which sends no
    //    sec-ch-ua header is lying about what it is. Same silent success as
    //    the honeypot: it learns nothing and does not retry.
    if (clientContradictsItself(req.headers)) {
      return SILENT_OK;
    }

    // 4) Per-IP rate limit, counted on SUCCESS only (see overRateLimit). An
    //    applicant who keeps being refused — by a bug of ours, as happened —
    //    must not be locked out for retrying.
    const ip = clientIp(req.headers);
    if (await overRateLimit("vendor-apply", ip, { max: RATE_LIMIT, windowMs: RATE_WINDOW_MS })) {
      return NextResponse.json(
        { success: false, error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // The form sends personalEmail (required) and businessEmail (optional).
    // Fall back to the old single "email" field so a page cached from before
    // this change can still submit.
    const personalRaw = data.personalEmail ?? data.email;
    if (!data.name || !personalRaw || !data.category || !data.description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // 5) Basic shape/length validation — reject obviously bogus payloads.
    const email = String(personalRaw).trim().toLowerCase();
    // Optional at the API so a page cached from before these fields existed
    // can still submit; the form itself requires them.
    const firstName = data.firstName ? String(data.firstName).trim().slice(0, 60) : null;
    const lastName = data.lastName ? String(data.lastName).trim().slice(0, 60) : null;
    const businessEmail = data.businessEmail
      ? String(data.businessEmail).trim().toLowerCase().slice(0, 160)
      : null;
    const name = String(data.name).trim();
    const category = String(data.category).trim();
    const description = String(data.description).trim();
    // Optional website — stored as entered (the UI normalizes to https:// on display).
    const website = data.website ? String(data.website).trim().slice(0, 200) : null;
    // Optional promoter code: the promoter who signed this vendor up earns the
    // coordinator share of every sale (owner's model, 2026-11-02). Resolved
    // against active promoters; an unknown code is ignored rather than refused.
    const promoterCode = data.promoterCode ? String(data.promoterCode).trim().toUpperCase().slice(0, 40) : "";
    const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailOk = EMAIL_SHAPE.test(email);
    if (businessEmail && !EMAIL_SHAPE.test(businessEmail)) {
      return NextResponse.json(
        { success: false, error: "That business email doesn't look right — check it, or leave it blank." },
        { status: 400 }
      );
    }
    if (
      !emailOk ||
      name.length > 120 ||
      email.length > 160 ||
      category.length > 80 ||
      description.length > 4000
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid submission." },
        { status: 400 }
      );
    }

    // Signed in while applying? Then we know exactly whose vendor this is and
    // approval needs no email matching at all. Taken from the verified session,
    // never from the request body — and the insert policy refuses any user_id
    // that isn't the caller's own.
    const { data: { user: applicant } } = await supabase.auth.getUser();

    // Written with the service role: direct inserts into `vendors` are closed
    // in the database, so an application can only arrive through this route
    // and the bot checks above.
    const svc = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    type Referrer = { user_id: string; referral_code: string };
    let referrer: Referrer | null = null;
    if (promoterCode) {
      const { data: p } = await svc.from("festdash_promoters").select("user_id, referral_code").ilike("referral_code", promoterCode).eq("is_active", true).maybeSingle();
      referrer = (p as Referrer | null) ?? null;
    }
    const { data: created, error } = await svc.from("vendors").insert([
      {
        name,
        email,
        business_email: businessEmail,
        first_name: firstName,
        last_name: lastName,
        user_id: applicant?.id ?? null,
        category,
        description,
        website,
        coordinator_user_id: referrer?.user_id ?? null,
        coordinator_code: referrer?.referral_code ?? null,
        capacity: data.capacity ? String(data.capacity).trim().slice(0, 60) : null,
        // is_public is the live listing flag and an applicant may never set it:
        // the "public apply as vendor" RLS policy requires false, and sending
        // true refused the whole application with "new row violates row-level
        // security policy for table vendors". What they picked is a request,
        // recorded separately for the admin to act on at approval.
        is_public: false,
        wants_public: data.public === "true" || data.public === true,
        status: "pending",
        vendor_type: "listed",
        is_founder: false,
      },
    ]).select("id").single();

    if (error) {
      console.error("VENDOR INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Tell the owner, with the whole application in the email. Until 2026-11-02
    // this route sent nothing: applications sat in /admin/vendors unannounced.
    const wantsPublic = data.public === "true" || data.public === true;
    await notifyNewApplication({
      kind: "marketplace",
      name,
      email,
      reviewPath: `/admin/vendors#vendor-${created.id}`,
      fields: vendorApplicationFields({
        id: created.id, name, category, description, email, business_email: businessEmail,
        first_name: firstName, last_name: lastName, phone: null, website,
        capacity: data.capacity ? String(data.capacity).trim().slice(0, 60) : null, wants_public: wantsPublic,
        area: null, region: null, currency: null, whatsapp_number: null, coordinator_code: null, coordinator_user_id: null,
        payout_wallets: null, terms_accepted_at: null, created_at: new Date().toISOString(),
      }),
    });

    // Only a stored application counts against the limit.
    await recordAttempt("vendor-apply", ip);

    return NextResponse.json({
      success: true,
      message: "Application submitted successfully.",
    });
  } catch (error) {
    console.error("VENDOR API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
