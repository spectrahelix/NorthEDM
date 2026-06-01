import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const data = await req.json();

    if (!data.name || !data.email || !data.category || !data.description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("vendors").insert([
      {
        name: String(data.name).trim(),
        email: String(data.email).trim().toLowerCase(),
        category: String(data.category).trim(),
        description: String(data.description).trim(),
        capacity: data.capacity ? String(data.capacity).trim() : null,
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
