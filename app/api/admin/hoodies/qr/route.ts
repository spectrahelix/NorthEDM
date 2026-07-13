import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { adminGuard } from "@/utils/admin";

// Returns a print-ready SVG QR for a hoodie code, pointing at the scan URL
// (https://<site>/h/<code>). Admin-only. This is the vector to hand Bright
// Future for the woven/embroidered QR. ?download=1 forces a file download.
export async function GET(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "Missing code." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://northedm.com";
  const target = `${origin.replace(/\/$/, "")}/h/${encodeURIComponent(code)}`;

  // High error-correction (H) so the code survives being knitted/embroidered.
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const download = url.searchParams.get("download");
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="hoodie-${code}.svg"` } : {}),
    },
  });
}
