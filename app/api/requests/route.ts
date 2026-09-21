import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireVerifiedUser } from "@/utils/authGate";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // Service requests are for verified members only. This route previously had
    // no auth check whatsoever, and the matching RLS policy allowed anonymous
    // inserts, so anything on the internet could file one.
    const gate = await requireVerifiedUser(supabase);
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }

    const data = await req.json();

    if (!data.name || !data.email || !data.serviceType || !data.description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("requests").insert([
      {
        name: String(data.name).trim(),
        email: String(data.email).trim().toLowerCase(),
        service_type: String(data.serviceType).trim(),
        description: String(data.description).trim(),
        urgency: data.urgency ? String(data.urgency).trim() : null,
        budget: data.budget ? String(data.budget).trim() : null,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("REQUEST INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Request submitted successfully.",
    });
  } catch (error) {
    console.error("REQUEST API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
