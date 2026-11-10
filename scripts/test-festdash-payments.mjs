import assert from "node:assert/strict";
import { settleFestdashCard } from "../utils/festdashPaymentCore.ts";
import { newHandoffCodes } from "../utils/festdashHandoff.ts";

const base = { id: "order-test", intent: "pi_test", checkout: null, completed: true, bothConfirmed: true, totalCents: 3000, currency: "USD" };
function provider(status = "requires_capture", extra = {}) {
  const pi = { id: "pi_test", status, amount: 3000, amount_received: 3000, amount_capturable: 3000, currency: "usd", latest_charge: { refunded: false, amount_refunded: 0 }, ...extra };
  const calls = [];
  const stripe = {
    paymentIntents: {
      retrieve: async (...args) => { calls.push(["retrieve", ...args]); return pi; },
      capture: async (...args) => { calls.push(["capture", ...args]); pi.status = "succeeded"; return pi; },
      cancel: async (...args) => { calls.push(["cancel", ...args]); pi.status = "canceled"; return pi; },
    },
    refunds: { create: async (...args) => { calls.push(["refund", ...args]); return { id: "re_test", status: "succeeded" }; }, retrieve: async (...args) => { calls.push(["refund-retrieve", ...args]); return { id: "re_test", status: "succeeded" }; } },
    checkout: { sessions: {
      retrieve: async () => ({ id: "cs_test", status: "open", payment_intent: null }),
      expire: async (...args) => { calls.push(["expire", ...args]); },
    } },
  };
  return { pi, calls, stripe };
}

for (let i = 0; i < 1000; i++) {
  const codes = newHandoffCodes(); assert.match(codes.customer, /^\d{4}$/); assert.match(codes.fulfiller, /^\d{4}$/); assert.notEqual(codes.customer, codes.fulfiller);
}
const held = provider();
await assert.rejects(settleFestdashCard(held.stripe, { ...base, bothConfirmed: false }), /Both parties/);
assert.equal(held.calls.length, 0, "a single confirmation must not even call the provider");
assert.deepEqual(await settleFestdashCard(held.stripe, base), { status: "released", paid: true });
await settleFestdashCard(held.stripe, base);
assert.equal(held.calls.filter(c => c[0] === "capture").length, 1, "retries cannot capture twice");
assert.equal(held.calls.find(c => c[0] === "capture")[3].idempotencyKey, "fd_capture_order-test");

const timeout = provider();
timeout.stripe.paymentIntents.capture = async (...args) => { timeout.calls.push(["capture", ...args]); timeout.pi.status = "succeeded"; throw new Error("network timeout after capture"); };
await assert.rejects(settleFestdashCard(timeout.stripe, base), /timeout/);
assert.equal((await settleFestdashCard(timeout.stripe, base)).status, "released");
assert.equal(timeout.calls.filter(c => c[0] === "capture").length, 1);

const failed = provider();
assert.deepEqual(await settleFestdashCard(failed.stripe, { ...base, completed: false, bothConfirmed: false }), { status: "canceled", paid: false });
assert.equal(failed.calls.filter(c => c[0] === "capture" || c[0] === "refund").length, 0);

const charged = provider("succeeded", { transfer_data: { destination: "acct_test" } });
assert.equal((await settleFestdashCard(charged.stripe, { ...base, completed: false })).status, "refunded");
const refund = charged.calls.find(c => c[0] === "refund");
assert(refund[1].reverse_transfer && refund[1].refund_application_fee);
assert.equal(refund[2].idempotencyKey, "fd_failed_refund_order-test");
const pending = provider("succeeded"); pending.stripe.refunds.create = async () => ({ status: "pending" });
assert.equal((await settleFestdashCard(pending.stripe, { ...base, completed: false })).status, "refund_pending");
const rejected = provider("succeeded"); rejected.stripe.refunds.create = async () => ({ status: "failed" });
await assert.rejects(settleFestdashCard(rejected.stripe, { ...base, completed: false }), /could not complete the refund/);

const expired = provider("canceled"); await assert.rejects(settleFestdashCard(expired.stripe, base), /expired/);
const refunded = provider("succeeded", { latest_charge: { refunded: true } });
await assert.rejects(settleFestdashCard(refunded.stripe, base), /refunded or disputed/);
assert.equal((await settleFestdashCard(refunded.stripe, { ...base, completed: false })).status, "refunded");
assert(!refunded.calls.some(c => c[0] === "refund"), "an already refunded payment is not refunded again");
const unpaid = provider();
assert.equal((await settleFestdashCard(unpaid.stripe, { ...base, intent: null, checkout: "cs_test", completed: false })).status, "canceled");
assert(unpaid.calls.some(c => c[0] === "expire"));
const zero = provider(); assert.equal((await settleFestdashCard(zero.stripe, { ...base, totalCents: 0, intent: null })).status, "released"); assert.equal(zero.calls.length, 0);
const retryRefund = provider("succeeded"); await settleFestdashCard(retryRefund.stripe, { ...base, completed: false, refundId: "re_test" });
assert(!retryRefund.calls.some(c => c[0] === "refund"), "a known pending refund is retrieved instead of created again");
const mismatch = provider("requires_capture", { amount: 100 }); await assert.rejects(settleFestdashCard(mismatch.stripe, base), /does not match/);
assert(!mismatch.calls.some(c => c[0] === "capture"));
const partial = provider("succeeded", { amount_received: 100 }); await assert.rejects(settleFestdashCard(partial.stripe, base), /not available for capture/);
const insufficient = provider("requires_capture", { amount_capturable: 100 }); await assert.rejects(settleFestdashCard(insufficient.stripe, base), /full order amount/);
assert(!insufficient.calls.some(c => c[0] === "capture"));
console.log("FestDash provider checks passed: fail-closed confirmation gate, capture retry, ambiguous timeout, hold cancellation, refund reversal, pending/failed refunds, expiry, and unpaid checkout cancellation. No real payment was made.");
