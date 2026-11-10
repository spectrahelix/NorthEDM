import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { settleFestdashOrder } from "@/utils/festdashSettlement";
import { newHandoffCodes } from "@/utils/festdashHandoff";
import { notifyFeedback } from "@/utils/alerts";

export const runtime = "nodejs";

async function handoff(req: Request, params: Promise<{ id: string }>, action: "view" | "confirm" | "problem") {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const body = action === "view" ? {} : await req.json().catch(() => ({}));
  const operation = action === "view" ? "view" : body.action === "problem" ? "problem" : "confirm";
  const codes = newHandoffCodes();
  const admin = serviceClient();
  const { data, error } = await admin.rpc("festdash_handoff", {
    p_order_id: id, p_actor_id: user.id, p_action: operation,
    p_code: typeof body.code === "string" ? body.code : null,
    p_customer_code: codes.customer, p_fulfiller_code: codes.fulfiller,
    p_reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
  });
  if (error) {
    console.error("Private handoff records unavailable:", error.code);
    return NextResponse.json({ error: "Secure handoff is unavailable. Payment has not been released; contact NorthEDM." }, { status: 503 });
  }
  if (!data?.ok) return NextResponse.json(data ?? { error: "Handoff failed." }, { status: data?.http_status ?? 500, headers: { "Cache-Control": "no-store" } });
  if (operation === "problem" && data.problem_new) await notifyFeedback({ category: "festdash-handoff", message: `Payment release paused for FestDash order ${id}. A participant reported: ${typeof body.reason === "string" ? body.reason.slice(0, 500) : "Handoff problem"}. Review before canceling/refunding; do not bypass either person's confirmation.` }).catch(() => {});
  if (operation === "confirm" && data.ready) {
    const settlement = await settleFestdashOrder(admin, id);
    return NextResponse.json({ ...data, payment_status: settlement.status, payment_pending: settlement.pending }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) { return handoff(req, params, "view"); }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) { return handoff(req, params, "confirm"); }
