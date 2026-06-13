import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("vendor_id")
    .eq("id", user.id)
    .single();

  if (!profile?.vendor_id) {
    return NextResponse.json({ error: "No vendor linked to this account" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  const valid = ["accepted", "in_transit", "delivered", "declined"];
  if (!valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("festdash_orders")
    .update({ status })
    .eq("id", id)
    .eq("vendor_id", profile.vendor_id); // ownership enforced

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
