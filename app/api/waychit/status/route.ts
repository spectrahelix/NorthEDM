import { NextResponse } from "next/server";
import { serviceClient } from "@/utils/coordinator";
import { waychitState } from "@/utils/waychit";

// Whether checkout should offer "Wave / QMoney / Afrimoney via Waychit".
// Never reveals the keys — only whether the option is live and its fee rate.
export async function GET() {
  const s = await waychitState(serviceClient());
  return NextResponse.json({ enabled: s.enabled, fee_bps: s.fee_bps });
}
