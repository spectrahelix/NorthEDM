import { NextResponse } from "next/server";
import { serviceClient } from "@/utils/coordinator";
import { loadLocalRules } from "@/utils/localRules";

// Interim payment rules for Gambian (wallet-rail) shops (utils/localRules.ts):
// whether wallets are on, and the transfer fee rate.
export async function GET() {
  const r = await loadLocalRules(serviceClient());
  return NextResponse.json({ walletsEnabled: r.walletsEnabled, remitFeeBps: r.remitFeeBps });
}
