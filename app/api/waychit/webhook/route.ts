import { NextResponse } from "next/server";
import { serviceClient } from "@/utils/coordinator";
import { getPaymentRequest, verifyWaychitSignature } from "@/utils/waychit";
import { applyPayoutEvent, confirmWaychitPayment } from "@/utils/waychitOrders";

// Waychit webhook (register https://www.northedm.com/api/waychit/webhook in the
// Waychit merchant dashboard). Events: payment.request.completed,
// payout.succeeded, payout.failed, payout.reversed. Every event is verified on
// the RAW body (Waychit-Signature), recorded once in waychit_events, and a paid
// request is re-read from Waychit before any order is marked paid.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWaychitSignature(raw, req.headers.get("waychit-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  let event: { id?: string; type?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const eventId = String(event.id ?? ""), type = String(event.type ?? ""), data = event.data ?? {};
  if (!eventId || !type) return NextResponse.json({ error: "Missing id/type" }, { status: 400 });

  const admin = serviceClient();
  const { data: seen } = await admin.from("waychit_events").select("id").eq("id", eventId).maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  let result: unknown = null;
  if (type === "payment.request.completed" && data.paymentStatus === "succeeded") {
    const requestId = String(data.id ?? "");
    // Don't take the event's word alone: the request must read back closed at Waychit.
    const fresh = await getPaymentRequest(requestId).catch(() => null);
    if (!fresh || (fresh.status && fresh.status !== "closed")) {
      // Not recorded, so Waychit's retry gets another chance once it reads closed.
      return NextResponse.json({ error: "Payment not confirmed by Waychit yet" }, { status: 409 });
    }
    const meta = (data.metadata ?? {}) as Record<string, string>;
    let kind: "festdash" | "store" | null = meta.kind === "store" ? "store" : meta.kind === "festdash" ? "festdash" : null;
    let orderId = meta.orderId ?? null;
    if (!orderId || !kind) {
      // clientReference may come back null; fall back to the request id we stored.
      const [{ data: f }, { data: s }] = await Promise.all([
        admin.from("festdash_orders").select("id").eq("waychit_request_id", requestId).maybeSingle(),
        admin.from("store_orders").select("id").eq("waychit_request_id", requestId).maybeSingle(),
      ]);
      if (f) { kind = "festdash"; orderId = f.id; } else if (s) { kind = "store"; orderId = s.id; }
    }
    if (kind && orderId) {
      result = await confirmWaychitPayment(admin, kind, orderId, {
        requestId, amountGmd: Number(data.amount ?? fresh.amount ?? 0), transactionReference: (data.transactionReference as string | null) ?? null,
      });
      if (result && typeof result === "object" && (result as { reason?: string }).reason === "amount short") {
        console.error("waychit: paid amount below the order total", requestId, orderId);
      }
    } else {
      console.error("waychit: paid request matches no order", requestId);
    }
  } else if (type.startsWith("payout.")) {
    await applyPayoutEvent(admin, type, String(data.id ?? ""));
  }

  await admin.from("waychit_events").insert({ id: eventId, type, object_id: String(data.id ?? ""), payload: event as never });
  return NextResponse.json({ ok: true, result });
}
