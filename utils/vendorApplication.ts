import type { EmailRow } from "@/utils/notifyEmail";

/** The columns an application alert and the admin review page need. */
export type VendorApplicationRow = {
  id?: number | null;
  name: string | null;
  category: string | null;
  description: string | null;
  email: string | null;
  business_email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  website: string | null;
  capacity: string | null;
  wants_public: boolean | null;
  area: string | null;
  region: string | null;
  currency: string | null;
  whatsapp_number: string | null;
  coordinator_code: string | null;
  coordinator_user_id: string | null;
  payout_wallets: unknown;
  terms_accepted_at: string | null;
  created_at: string | null;
};

type Wallets = { wave?: string | null; qmoney?: string | null; afrimoney?: string | null; preferred?: string | null } | null;

/**
 * Everything an applicant submitted, labelled, in one place — the owner's alert
 * email and the "Email me this application" button both use it, so the two
 * can't drift apart. Empty values are dropped by the renderer.
 */
export function vendorApplicationFields(v: VendorApplicationRow, coordinatorName?: string | null): EmailRow[] {
  const applicant = [v.first_name, v.last_name].filter(Boolean).join(" ").trim() || null;
  const w = (v.payout_wallets ?? null) as Wallets;
  const wallets = w
    ? [w.wave ? `Wave ${w.wave}` : null, w.qmoney ? `QMoney ${w.qmoney}` : null, w.afrimoney ? `Afrimoney ${w.afrimoney}` : null]
        .filter(Boolean)
        .join(" · ")
    : "";
  const coordinator = v.coordinator_code
    ? `${coordinatorName ? `${coordinatorName} · ` : ""}code ${v.coordinator_code}`
    : v.coordinator_user_id
      ? coordinatorName ?? "assigned"
      : null;
  return [
    ["Business", v.name],
    ["Applicant", applicant],
    ["Personal email", v.email],
    ["Business email", v.business_email],
    ["Phone", v.phone],
    ["WhatsApp", v.whatsapp_number],
    ["Website", v.website],
    ["Category", v.category],
    ["Capacity", v.capacity],
    ["Area", v.area],
    ["Region", v.region ? `${v.region}${v.currency ? ` · ${v.currency}` : ""}` : null],
    ["Coordinator", coordinator],
    ["Payout wallets", wallets ? `${wallets}${w?.preferred ? ` · preferred: ${w.preferred}` : ""}` : null],
    ["Wants public listing", v.wants_public == null ? null : v.wants_public ? "yes" : "no"],
    ["Terms accepted", v.terms_accepted_at ? new Date(v.terms_accepted_at).toUTCString() : null],
    ["Applied", v.created_at ? new Date(v.created_at).toUTCString() : null],
    ["Description", v.description],
  ];
}
