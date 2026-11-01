/**
 * Plain-language timing notes for each way money moves in a coordinator
 * region. Deliberately hedged: the providers set these times, not us, and we
 * have not measured them. Shown wherever someone is about to wait on a
 * transfer — checkout, the "pay by …" screen, shop setup, the purse console.
 */
export const PAYMENT_NOTES: Record<string, { label: string; timing: string }> = {
  wave: { label: "Wave", timing: "Wave-to-Wave transfers usually arrive within moments." },
  qmoney: { label: "QMoney", timing: "QMoney transfers usually arrive within minutes; busy periods can take longer." },
  afrimoney: { label: "Afrimoney", timing: "Afrimoney transfers usually arrive within minutes; busy periods can take longer." },
  cash: { label: "Cash on delivery", timing: "Paid to the runner at handover — nothing to wait for." },
  remitly: { label: "Remitly", timing: "Depends on how the money is received: minutes for some methods, up to a few business days for others." },
};

export const PAYMENT_DISCLAIMER =
  "Transfer times are set by each payment provider, not by FestDash or NorthEDM, and can vary. " +
  "An order starts once the shop's purse keeper sees the money in their wallet. " +
  "A shop's earnings are paid out by its coordinator on the schedule they agree, to the wallet the shop chose.";
