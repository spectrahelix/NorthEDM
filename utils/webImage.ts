/**
 * Make a phone photo safe to put on the web, in the browser, before upload.
 *
 * iPhones save photos as HEIC. Safari can show HEIC; Chrome, Firefox and every
 * Android browser cannot, so a vendor's product photo uploaded straight from
 * an iPhone rendered as a broken image for most customers (first real case:
 * 2026-10-10, a 4284×5712 .heic on The Obsidian Cloak's first product).
 *
 * The browser that PICKED the photo can always decode it — that's how it shows
 * the preview — so we redraw it onto a canvas and export a JPEG, capped at
 * MAX_EDGE px. That also takes a 3–8 MB camera original down to a few hundred
 * KB, well under Vercel's 4.5 MB request-body limit.
 *
 * Fails soft: if the browser can't decode the file, the original is returned
 * and the server's own type check gives the person a readable answer.
 *
 * Pair with ACCEPT_WEB_IMAGES on the <input>: naming concrete types (instead of
 * image/*) makes iOS hand over a JPEG itself, so this is the second line.
 */
export const ACCEPT_WEB_IMAGES = "image/jpeg,image/png,image/webp,image/gif";

const MAX_EDGE = 1600;
const SAFE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function toWebImage(file: File): Promise<File> {
  const isSafe = SAFE_TYPES.has(file.type) && !/\.(heic|heif)$/i.test(file.name);
  // Small, web-native files go up untouched (keeps PNG transparency, GIF motion).
  if (isSafe && file.size <= 1.5 * 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** True for formats most browsers can't display. Used server-side as a backstop. */
export function isUndisplayableImage(name: string, type: string): boolean {
  return /\.(heic|heif)$/i.test(name) || /image\/hei[cf]/i.test(type);
}
