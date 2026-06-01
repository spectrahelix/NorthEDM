import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const data = await req.json();

    const { error } = await supabase.from("products").insert([
      {
        vendor_id: Number(data.vendorId),
        name: data.name,
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