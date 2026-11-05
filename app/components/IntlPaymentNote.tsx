// One small, quiet note for anyone signing up or ordering from outside the
// US (owner's wording, 2026-11-05). Interim rule: international shops and
// orders are card / Google Pay only (utils/localRules.ts). Server- and
// client-safe: no hooks.
export const INTL_PAYMENT_TEXT =
  "If signing up or ordering for parties outside of the US, purchases can only be made with Visa, Mastercard, Debit, GooglePay. Additional fees may apply.";

export function IntlPaymentNote({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-flex items-start gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] leading-snug text-neutral-500 ${className}`}>
      <span aria-hidden>🌍</span>
      <span>{INTL_PAYMENT_TEXT}</span>
    </p>
  );
}
