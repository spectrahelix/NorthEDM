import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const vendorId = Number(data.vendorId);

    // Verify the requesting user owns the vendor, or is archon/warden
    const [{ data: vendor }, { data: profile }] = await Promise.all([
      supabase.from("vendors").select("user_id").eq("id", vendorId).single(),
      supabase.from("user_profiles").select("role").eq("id", user.id).single(),
    ]);

    const isAdmin = profile?.role === "archon" || profile?.role === "warden";
    if (!isAdmin && vendor?.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("products").insert([
      {
        vendor_id: vendorId,
        name: String(data.name ?? "").trim(),
        category: data.category,
        description: data.description,
        price: Number(data.price),
        inventory_count: Number(data.inventoryCount),
        image_url: data.imageUrl || null,
        is_public: data.isPublic,
        status: data.status || "draft",
      },
    ]);

    if (error) {
      console.error("PRODUCT INSERT ERROR:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PRODUCT API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 }
    );
  }
}