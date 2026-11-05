import { NextResponse } from "next/server";
import { serviceClient } from "@/utils/coordinator";
import { loadLocalRules, remitFeeIn } from "@/utils/localRules";

// Interim payment rules for Gambian (wallet-rail) shops (utils/localRules.ts):
// whether wallets are on, and the transfer fee in the asked-for currency.
export async function GET(req: Request) {
  const currency = (new URL(req.url).searchParams.get("currency") || "USD").toUpperCase().slice(0, 3);
  const r = await loadLocalRules(serviceClient());
  return NextResponse.json({ walletsEnabled: r.walletsEnabled, remitFeeUsdCents: r.remitFeeUsdCents, remitFeeCents: await remitFeeIn(currency, r.remitFeeUsdCents), currency });
}
