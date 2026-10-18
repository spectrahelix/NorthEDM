import { toWebImage } from "@/utils/webImage";

/**
 * Upload a product photo for the signed-in vendor and return its public URL.
 * Converts first (HEIC → JPEG, large → 1600px). One path for every inventory
 * screen, so a fix here reaches all of them.
 */
export async function uploadProductPhoto(picked: File): Promise<string> {
  const file = await toWebImage(picked);
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/vendor/products/upload", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) throw new Error(j.error || "Upload failed.");
  return j.url as string;
}

export type GalleryImage = { id: number; url: string; position: number };

/** Add an uploaded photo to the end of an item's gallery. Returns the gallery. */
export async function addProductImage(productId: number, url: string): Promise<GalleryImage[]> {
  const res = await fetch(`/api/vendor/products/${productId}/images`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Couldn't add that photo.");
  return j.images as GalleryImage[];
}
