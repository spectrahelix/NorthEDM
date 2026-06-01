import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    if (!data.id) {
      return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("vendors")
      .update({
        status: data.status,
        vendor_type: data.vendorType,
        is_public: data.isPublic,
      })
      .eq("id", data.id);

    if (error) {
      console.error("VENDOR UPDATE ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("VENDOR UPDATE API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}
