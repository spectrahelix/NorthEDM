import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Uploads a product image to the public shop-products bucket (server-side).
export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Max 8MB." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await g.admin.storage
    .from("shop-products")
    .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = g.admin.storage.from("shop-products").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
