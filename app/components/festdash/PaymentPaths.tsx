/**
 * "Which way do you pay?" — the three situations a customer (or a shop's
 * customers) can be in, spelled out in the walkthroughs. The rail is a property
 * of the SHOP: a Gambian shop with a coordinator takes Wave / QMoney / Afrimoney
 * in dalasi; a US shop and NorthEDM's own shop take cards through Stripe. Keep
 * this honest — a wallet-rail shop cannot take a card today, and saying so here
 * beats a customer finding out at checkout.
 */
const PATHS = [
  {
    have: "Only Gambian payment (Wave, QMoney or Afrimoney)",
    customer: "Order from any Gambian shop on FestDash or its online store. Pay the shop's coordinator by wallet, enter your transaction reference, and the shop gets your order once it's confirmed. US shops and NorthEDM merch take cards only, so they're not open to you yet.",
    shop: "Your natural customers. They pay your coordinator by wallet; you're paid your share in dalasi.",
  },
  {
    have: "Both — a Gambian wallet and a US or international card",
    customer: "Wallet at Gambian shops, card at US shops and NorthEDM merch. A Gambian shop can't take your card, so pick the wallet there.",
    shop: "They buy from you by wallet, same as above. The card only matters elsewhere on the site.",
  },
  {
    have: "Only a US or international card",
    customer: "US shops and NorthEDM merch are open to you by card. Gambian shops can't take a card yet, so you can't order from them for now.",
    shop: "They can't buy from you yet — tourists and visiting family included. Card payment to Gambian shops is on the list; ask your coordinator for news.",
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
          ? "How you pay depends on the shop, not on you. Here's what each situation opens up."
          : "A Gambian shop sells for Wave, QMoney and Afrimoney in dalasi. What that means for each kind of customer:"}
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

/** One line for the wallet picker itself, where a card-only visitor would otherwise hunt for a card option. */
export function WalletOnlyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-neutral-500 ${className}`}>
      This shop takes Gambian wallets only. If you only have a US or international card, it can&apos;t take your order yet — US shops and NorthEDM merch can.
    </p>
  );
}
