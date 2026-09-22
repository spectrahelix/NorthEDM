import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { clientIp, clientContradictsItself, overRateLimit } from "@/utils/botSignals";

// Per-IP throttle. This was an in-memory Map, which on serverless is close to
// useless — it dies on every cold start and each instance keeps its own copy,
// so a caller spread across instances is never counted. It now shares the
// durable counter in public.request_throttle with the other guest-open routes.
const RATE_LIMIT = 3; // submissions
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

    // 4) Per-IP rate limit, now durable rather than per-instance.
    const ip = clientIp(req.headers);
    if (await overRateLimit("vendor-apply", ip, { max: RATE_LIMIT, windowMs: RATE_WINDOW_MS })) {
      return NextResponse.json(
        { success: false, error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    if (!data.name || !data.email || !data.category || !data.description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // 5) Basic shape/length validation — reject obviously bogus payloads.
    const email = String(data.email).trim().toLowerCase();
    const name = String(data.name).trim();
    const category = String(data.category).trim();
    const description = String(data.description).trim();
    // Optional website — stored as entered (the UI normalizes to https:// on display).
    const website = data.website ? String(data.website).trim().slice(0, 200) : null;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const { error } = await supabase.from("vendors").insert([
      {
        name,
        email,
        category,
        description,
        website,
        capacity: data.capacity ? String(data.capacity).trim().slice(0, 60) : null,
        is_public: data.public === "true" || data.public === true,
        status: "pending",
        vendor_type: "listed",
        is_founder: false,
      },
    ]);

    if (error) {
      console.error("VENDOR INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

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
