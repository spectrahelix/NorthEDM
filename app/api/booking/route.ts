import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireVerifiedUser } from "@/utils/authGate";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Verified accounts only — the matching RLS policy enforces this too.
    const gate = await requireVerifiedUser(supabase);
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }
    const data = await req.json();

    if (!data.name || !data.email || !data.groupSize || !data.date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("bookings").insert([
      {
        name: String(data.name).trim(),
        email: String(data.email).trim().toLowerCase(),
        group_size: Number(data.groupSize),
        preferred_date: data.date,
        notes: data.notes ? String(data.notes).trim() : null,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("BOOKING INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Booking saved successfully.",
    });
  } catch (error) {
    console.error("BOOKING API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
