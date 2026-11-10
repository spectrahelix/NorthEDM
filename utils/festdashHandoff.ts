import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function newHandoffCodes() {
  const customer = String(randomInt(10_000)).padStart(4, "0");
  let fulfiller = customer;
  while (fulfiller === customer) fulfiller = String(randomInt(10_000)).padStart(4, "0");
  return { customer, fulfiller };
}

export async function ensureFestdashHandoff(admin: SupabaseClient, orderId: string) {
  const codes = newHandoffCodes();
  const { error } = await admin.from("festdash_handoffs").upsert({
    order_id: orderId, customer_code: codes.customer, fulfiller_code: codes.fulfiller,
  }, { onConflict: "order_id", ignoreDuplicates: true });
  if (error) throw new Error("Secure handoff records are unavailable. No new payment should be started.");
}
