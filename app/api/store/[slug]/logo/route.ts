import { NextResponse } from "next/server";
import { guardStoreOperator } from "@/utils/store";
import { isUndisplayableImage } from "@/utils/webImage";

// Upload or remove a store's logo — its operator or a NorthEDM admin.
// Stored in the public shop-products bucket under stores/<store id>/.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Logo must be under 4MB." }, { status: 400 });
  if (isUndisplayableImage(file.name, file.type)) {
    return NextResponse.json({ error: "That image is in iPhone HEIC format. Please pick it again, or choose a PNG/JPEG." }, { status: 400 });
  }
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return NextResponse.json({ error: "Please choose a PNG, JPEG or WebP image." }, { status: 400 });

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `stores/${g.store.id}/logo-${Date.now()}.${ext}`;
  const { error } = await g.admin.storage.from("shop-products")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = g.admin.storage.from("shop-products").getPublicUrl(path).data.publicUrl;
  const { error: uErr } = await g.admin.from("stores").update({ logo_url: url }).eq("id", g.store.id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await guardStoreOperator(slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { error } = await g.admin.from("stores").update({ logo_url: null }).eq("id", g.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
