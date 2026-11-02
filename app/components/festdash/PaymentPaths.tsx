/**
 * "Which way do you pay?" — the three situations a customer (or a shop's
 * customers) can be in, spelled out in the walkthroughs. Since 2026-11-03 a
 * Gambian shop takes BOTH: Wave / QMoney / Afrimoney in dalasi paid to its
 * coordinator, and any card (charged in dalasi to NorthEDM, whose share of it
 * the owner forwards to the coordinator). US shops and NorthEDM merch are
 * card only.
 */
const PATHS = [
  {
    have: "Only Gambian payment (Wave, QMoney or Afrimoney)",
    customer: "Order from any Gambian shop on FestDash or its online store. Pay the shop's coordinator by wallet, enter your transaction reference, and the shop gets your order once it's confirmed. US shops and NorthEDM merch take cards only, so they're not open to you yet.",
    shop: "Your natural customers. They pay your coordinator by wallet; you're paid your share in dalasi.",
  },
  {
    have: "Both — a Gambian wallet and a US or international card",
    customer: "Your choice at a Gambian shop: wallet, or card charged in dalasi. Card at US shops and NorthEDM merch.",
    shop: "They can pay you either way. A card sale is charged in dalasi and your share reaches you through your coordinator.",
  },
  {
    have: "Only a US or international card",
    customer: "Everything is open to you. At a Gambian shop pick Card; it's charged in dalasi and held until your order is delivered. Your bank may add a small foreign-currency fee.",
    shop: "Tourists and visiting family can buy from you by card. The charge is in dalasi; your share reaches you through your coordinator.",
  },
];

export function PaymentPaths({ audience, className = "" }: { audience: "customer" | "shop"; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/3 p-5 ${className}`}>
      <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">
        {audience === "customer" ? "Which way do you pay?" : "Who can buy from you"}
      </p>
      <p className="mt-1 text-sm text-neutral-400">
        {audience === "customer"
          ? "How you pay depends on the shop. Here's what each situation opens up."
          : "A Gambian shop sells for Wave, QMoney, Afrimoney and card, all in dalasi. What that means for each kind of customer:"}
      </p>
      <ul className="mt-4 space-y-3">
        {PATHS.map((p) => (
          <li key={p.have} className="rounded-xl bg-white/5 p-3 text-sm">
            <p className="font-semibold text-white">{p.have}</p>
            <p className="mt-1 text-neutral-300">{audience === "customer" ? p.customer : p.shop}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
