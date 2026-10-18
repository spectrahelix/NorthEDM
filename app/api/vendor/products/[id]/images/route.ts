import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isUndisplayableImage } from "@/utils/webImage";

// An item's photo gallery: list, add, reorder, remove.
//
// Runs as the signed-in user, so product_images' RLS (can_manage_product) is
// what decides who may change a gallery — the same rule as editing the item.
// After every change products.image_url is set to the first photo, so every
// list that shows a thumbnail keeps working without knowing galleries exist.

type Ctx = { params: Promise<{ id: string }> };
const MAX_PHOTOS = 24;

async function setup(ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const productId = Number((await ctx.params).id);
  return { supabase, user, productId };
}

async function list(supabase: Awaited<ReturnType<typeof createClient>>, productId: number) {
  const { data } = await supabase
    .from("product_images").select("id, url, position")
    .eq("product_id", productId).order("position").order("id");
  return (data ?? []) as { id: number; url: string; position: number }[];
}

/** Keep the item's main photo equal to the gallery's first. */
async function syncMain(supabase: Awaited<ReturnType<typeof createClient>>, productId: number) {
  const images = await list(supabase, productId);
  await supabase.from("products").update({ image_url: images[0]?.url ?? null }).eq("id", productId);
  return images;
}

async function canEdit(supabase: Awaited<ReturnType<typeof createClient>>, productId: number) {
  const { data } = await supabase.rpc("can_manage_product", { pid: productId });
  return data === true;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { supabase, productId } = await setup(ctx);
  return NextResponse.json({ images: await list(supabase, productId) });
}

// Add one photo (already uploaded via /api/vendor/products/upload) to the end.
export async function POST(req: Request, ctx: Ctx) {
  const { supabase, user, productId } = await setup(ctx);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEdit(supabase, productId))) return NextResponse.json({ error: "That isn't your item." }, { status: 403 });

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url || !/^https:\/\//.test(url)) return NextResponse.json({ error: "Missing photo." }, { status: 400 });
  if (isUndisplayableImage(url, "")) return NextResponse.json({ error: "That photo format can't be shown on most phones. Please pick it again." }, { status: 400 });

  const current = await list(supabase, productId);
  if (current.length >= MAX_PHOTOS) return NextResponse.json({ error: `An item can have up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  const position = current.length ? Math.max(...current.map((i) => i.position)) + 1 : 0;

  const { error } = await supabase.from("product_images").insert({ product_id: productId, url: url.split("?")[0], position });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: await syncMain(supabase, productId) });
}

// Reorder: { order: [imageId, …] } — first becomes the main photo.
export async function PATCH(req: Request, ctx: Ctx) {
  const { supabase, user, productId } = await setup(ctx);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEdit(supabase, productId))) return NextResponse.json({ error: "That isn't your item." }, { status: 403 });

  const { order } = (await req.json().catch(() => ({}))) as { order?: number[] };
  const current = await list(supabase, productId);
  const ids = new Set(current.map((i) => i.id));
  if (!Array.isArray(order) || order.length !== current.length || !order.every((id) => ids.has(id))) {
    return NextResponse.json({ error: "That order doesn't match this item's photos — reload and try again." }, { status: 409 });
  }
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase.from("product_images").update({ position: i }).eq("id", order[i]).eq("product_id", productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ images: await syncMain(supabase, productId) });
}

// Remove one photo from the item. The file stays in the vendor's photo
// library (/api/vendor/photos), where it can be reused or deleted for good.
export async function DELETE(req: Request, ctx: Ctx) {
  const { supabase, user, productId } = await setup(ctx);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEdit(supabase, productId))) return NextResponse.json({ error: "That isn't your item." }, { status: 403 });

  const { imageId } = (await req.json().catch(() => ({}))) as { imageId?: number };
  const { error } = await supabase.from("product_images").delete().eq("id", Number(imageId)).eq("product_id", productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: await syncMain(supabase, productId) });
}
