import { notifyFeedback } from "@/utils/alerts";

/**
 * Check the result of a write that matters, and make failure loud.
 *
 * Supabase returns errors as a value, not a throw. A write whose result is
 * never inspected therefore looks identical to a successful one — which is how
 * marketplace listing edits silently discarded every change for six of seven
 * listings, and how a two-month signup outage went unnoticed.
 *
 * On a payment path the same silence is worse: Stripe has taken the money and
 * the database does not know, with nothing in any log to say so.
 *
 * Deliberately a plain function over a result you already have, not a wrapper
 * around the query builder — so it reads as one extra line at the call site and
 * nothing about the surrounding code has to change:
 *
 *     await checkWrite("order -> paid", await db.from("orders").update(...).eq("id", id));
 *
 * `critical` additionally alerts the owner. Reserve it for money and state that
 * cannot be reconstructed; ordinary writes just need the log line.
 */
export async function checkWrite(
  label: string,
  result: { error: { message: string } | null },
  options?: { critical?: boolean }
): Promise<boolean> {
  if (!result?.error) return true;

  console.error(`[write failed] ${label}: ${result.error.message}`);

  if (options?.critical) {
    await notifyFeedback({
      message:
        `🚨 A PAYMENT-PATH WRITE FAILED — money may have moved without the ` +
        `database recording it.\n\nStep: ${label}\nError: ${result.error.message}\n\n` +
        `Check Stripe against the matching order row before doing anything else.`,
      category: "write-failure",
    }).catch((e) => console.error("write-failure alert failed:", e));
  }

  return false;
}
