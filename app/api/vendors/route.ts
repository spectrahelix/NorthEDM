import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Best-effort in-memory per-IP throttle (resets on cold start; defense-in-depth
// on top of the honeypot + timing trap below).
const RATE_LIMIT = 3; // submissions
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

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

    // 3) Per-IP rate limit.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
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

    // 4) Basic shape/length validation — reject obviously bogus payloads.
    const email = String(data.email).trim().toLowerCase();
    const name = String(data.name).trim();
    const category = String(data.category).trim();
    const description = String(data.description).trim();
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
