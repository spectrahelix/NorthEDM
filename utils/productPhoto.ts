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

/** Put a photo on an existing product, touching nothing else on it. */
export async function setProductPhoto(productId: number, imageUrl: string) {
  const res = await fetch(`/api/vendor/products/${productId}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageUrl }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Couldn't save the photo to that item.");
  return j.product as Record<string, unknown>;
}
