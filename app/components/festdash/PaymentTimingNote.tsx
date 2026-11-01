import { PAYMENT_NOTES, PAYMENT_DISCLAIMER } from "@/utils/paymentNotes";

/** The timing line for one method, or the full list plus the disclaimer. */
export function PaymentTimingNote({ method, all = false, className = "" }: { method?: string | null; all?: boolean; className?: string }) {
  if (all) {
    return (
      <div className={`text-xs text-neutral-500 ${className}`}>
        <ul className="space-y-1">
          {Object.entries(PAYMENT_NOTES).map(([k, n]) => (
            <li key={k}><span className="text-neutral-300">{n.label}:</span> {n.timing}</li>
          ))}
        </ul>
        <p className="mt-2 text-neutral-600">{PAYMENT_DISCLAIMER}</p>
      </div>
    );
  }
  const n = method ? PAYMENT_NOTES[method] : null;
  if (!n) return null;
  return <p className={`text-xs text-neutral-500 ${className}`}>{n.timing} {PAYMENT_DISCLAIMER.split(". ")[0]}.</p>;
}
