// PayPal Payouts — the alternative promoter payout rail (Stripe is the default).
//
// Same posture as Stripe: NorthEDM never holds the promoter's money. A payout is
// sent only after the refund-protection window closes, straight to the promoter's
// PayPal. Inactive unless PAYPAL_CLIENT_ID + PAYPAL_SECRET are configured, so the
// feature degrades to "unavailable" rather than erroring.

const LIVE = "https://api-m.paypal.com";
const SANDBOX = "https://api-m.sandbox.paypal.com";

function baseUrl() {
  // Default to sandbox unless explicitly set live — safer to no-op than to move
  // real money because of a missing env var.
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

export function payPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

async function accessToken(): Promise<string | null> {
  if (!payPalConfigured()) return null;
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
  try {
    const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      console.error("paypal token failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    return (await res.json()).access_token ?? null;
  } catch (e) {
    console.error("paypal token error:", e);
    return null;
  }
}

/**
 * Send one payout. `idempotencyKey` becomes the batch's sender_batch_id, which
 * PayPal rejects as a duplicate — so a retried release can't pay twice.
 */
export async function payPalPayout(opts: {
  email: string;
  amountCents: number;
  note: string;
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!payPalConfigured()) return { ok: false, reason: "PayPal not configured (PAYPAL_CLIENT_ID/PAYPAL_SECRET)" };
  if (!opts.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(opts.email)) {
    return { ok: false, reason: "promoter has no valid PayPal email" };
  }
  const token = await accessToken();
  if (!token) return { ok: false, reason: "PayPal auth failed" };

  try {
    const res = await fetch(`${baseUrl()}/v1/payments/payouts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: opts.idempotencyKey.slice(0, 30),
          email_subject: "Your NorthEDM commission",
          email_message: opts.note,
        },
        items: [{
          recipient_type: "EMAIL",
          receiver: opts.email,
          amount: { value: (opts.amountCents / 100).toFixed(2), currency: "USD" },
          note: opts.note,
          sender_item_id: opts.idempotencyKey.slice(0, 30),
        }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // A duplicate batch id means we already sent it — treat as success.
      if (body.includes("DUPLICATE_SENDER_BATCH_ID")) return { ok: true };
      return { ok: false, reason: `PayPal payout ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
