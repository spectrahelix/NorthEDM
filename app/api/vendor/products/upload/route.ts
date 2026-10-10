import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canManageInventory } from "@/utils/marketplace";
import { isUndisplayableImage } from "@/utils/webImage";

// Product image upload for Marketplace vendors (paid, guarded). Stores in the
// public shop-products bucket via the service role and returns the public URL.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canManageInventory(supabase, user))) {
    return NextResponse.json({ error: "Marketplace access required." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file." }, { status: 400 });
  // The page converts these to JPEG before upload; this catches a browser that
  // couldn't. Stored as-is, a HEIC shows as a broken image to most customers.
  if (isUndisplayableImage(file.name, file.type)) {
    return NextResponse.json({ error: "That photo is in iPhone HEIC format, which most browsers can't show. Please pick it again, or choose a JPEG or PNG." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 8MB." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from("shop-products")
    .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("shop-products").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
