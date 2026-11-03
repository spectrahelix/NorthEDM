/**
 * Local payment rails for coordinator ("purse keeper") regions — stage one.
 *
 * No money moves through the site. A customer pays the purse keeper's mobile
 * wallet (Wave, QMoney, Afrimoney) or cash on delivery; the purse keeper
 * confirms a wallet payment from their own wallet history; the ledger records
 * the split (shop 80 / owner 10 / coordinator 10 by default, see
 * coordinator_program_settings). Stage two replaces the manual confirm with a
 * provider webhook (Wave Checkout or a Gambian aggregator) and changes nothing
 * about the data: payment_method, payment_ref and payment_confirmed_* stay.
 *
 * Safe to import from client components — no secrets here.
 */
export const WALLET_METHODS = ["wave", "qmoney", "afrimoney"] as const;
export const LOCAL_METHODS = [...WALLET_METHODS, "cash"] as const;
export type WalletMethod = (typeof WALLET_METHODS)[number];
export type LocalMethod = (typeof LOCAL_METHODS)[number];
export type PaymentMethod = LocalMethod | "card";

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  wave: "Wave",
  qmoney: "QMoney",
  afrimoney: "Afrimoney",
  cash: "Cash on delivery",
  card: "Card",
};

export function isLocalMethod(m: unknown): m is LocalMethod {
  return typeof m === "string" && (LOCAL_METHODS as readonly string[]).includes(m);
}
export function isWalletMethod(m: unknown): m is WalletMethod {
  return typeof m === "string" && (WALLET_METHODS as readonly string[]).includes(m);
}

export type PurseWallets = {
  wave_number?: string | null;
  qmoney_number?: string | null;
  afrimoney_number?: string | null;
  whatsapp_number?: string | null;
};
/** The customer-facing wallet shape the vendors API attaches to a local shop. */
export type VendorPayments = { wave: string | null; qmoney: string | null; afrimoney: string | null; whatsapp: string | null };

export function walletNumberFor(w: PurseWallets | VendorPayments | null | undefined, method: string): string | null {
  if (!w) return null;
  const any = w as Record<string, string | null | undefined>;
  if (method === "wave") return any.wave ?? any.wave_number ?? null;
  if (method === "qmoney") return any.qmoney ?? any.qmoney_number ?? null;
  if (method === "afrimoney") return any.afrimoney ?? any.afrimoney_number ?? null;
  return null;
}

/** Short, human reference the customer types into their wallet transfer note. */
export function orderRef(orderId: string): string {
  return `FD-${orderId.replace(/-/g, "").slice(-6).toUpperCase()}`;
}

export type SplitSettings = {
  sale_owner_bps: number;
  sale_coordinator_bps: number;
  /** Extra platform share on FestDash DELIVERY orders (the network pays for delivery). */
  delivery_extra_bps?: number;
  subscription_fee_cents: number;
  subscription_coordinator_bps: number;
  bundle_fee_cents?: number;
  mint_max_percent_off?: number;
  mint_max_amount_off_cents?: number;
};
export const DEFAULT_SPLITS: SplitSettings = {
  sale_owner_bps: 1000, // the platform's whole share of a sale; the shop keeps the rest
  sale_coordinator_bps: 500, // the promoter's part OF that share (never on top of it)
  delivery_extra_bps: 1000, // FestDash delivery orders: shop keeps 80% instead of 90%
  subscription_fee_cents: 3000,
  subscription_coordinator_bps: 1000,
};

/**
 * A sale. The shop keeps the same share whether or not a promoter signed it
 * up: 100% − sale_owner_bps (90%) on store, marketplace and FestDash PICKUP
 * sales; a FestDash DELIVERY order adds delivery_extra_bps on top (shop keeps
 * 80%) because the network pays for delivery. The platform's share is split
 * between NorthEDM and the promoter who referred the shop
 * (sale_coordinator_bps of the sale, out of the platform's part — never on
 * top of it); with no promoter NorthEDM keeps the whole share.
 * Owner's rules, 2026-11-03.
 */
export function splitSale(totalCents: number, s: SplitSettings, hasCoordinator = true, delivery = false) {
  const platform = Math.round((totalCents * platformShareBps(s, delivery)) / 10000);
  const coordinator = hasCoordinator ? Math.min(platform, Math.round((totalCents * s.sale_coordinator_bps) / 10000)) : 0;
  return { owner: platform - coordinator, coordinator, shop: totalCents - platform };
}
/** The platform's total share of a sale in basis points — what the shop does
 *  NOT keep. On a card order this is the Stripe application fee; on a wallet
 *  sale it is what the purse keeper holds back. The promoter is paid out of it.
 *  `delivery` = a FestDash order a runner delivers (adds delivery_extra_bps). */
export function platformShareBps(s: SplitSettings, delivery = false): number {
  return s.sale_owner_bps + (delivery ? (s.delivery_extra_bps ?? 1000) : 0);
}

/**
 * Which rail a vendor's orders take. A shop assigned to a coordinator AND
 * priced in a non-USD currency is paid through the coordinator's wallets or
 * cash on delivery and is listed only while its monthly fee is current.
 * Everything else — including a US vendor whose coordinator earns a share of
 * each sale — stays on Stripe card checkout. One rule, used by the order API,
 * the vendor list, the FestDash page and the order page.
 */
export function isLocalRail(v: { coordinator_user_id?: string | null; currency?: string | null } | null | undefined): boolean {
  return !!v?.coordinator_user_id && String(v.currency ?? "USD").toUpperCase() !== "USD";
}

/**
 * Runner fee: what the customer adds for the runner, on top of the items. The
 * floor is 10% of the items (after any code); the customer may pick more. All
 * of it goes to the runner — it is outside the 90/10 split.
 */
export const RUNNER_FEE_MIN_BPS = 1000;
export const RUNNER_FEE_CHOICES_BPS = [1000, 1500, 2000, 2500] as const;
export function minRunnerFeeCents(itemsCents: number): number {
  return itemsCents > 0 ? Math.ceil((itemsCents * RUNNER_FEE_MIN_BPS) / 10000) : 0;
}

/** A monthly shop fee: the coordinator's cut, the owner gets the rest. */
export function splitSubscription(feeCents: number, s: SplitSettings) {
  const coordinator = Math.round((feeCents * s.subscription_coordinator_bps) / 10000);
  return { coordinator, owner: feeCents - coordinator };
}

/** wa.me click-to-chat. Numbers are stored however people type them. */
export function whatsappLink(number: string, text: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
