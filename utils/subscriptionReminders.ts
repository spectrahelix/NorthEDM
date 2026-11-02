import type { SupabaseClient } from "@supabase/supabase-js";
import { emailUser, notifyUserInApp, userEmailById } from "@/utils/notifyEmail";
import { isLocalRail } from "@/utils/gambiaPay";
import { formatMoney } from "@/utils/money";
import { loadSplitSettings } from "@/utils/coordinator";

/**
 * Fee reminders for coordinator shops. A shop on the local rail is listed only
 * while a paid period is current, and before this nobody was told when one was
 * about to end: the shop just vanished from FestDash the next morning. Three
 * reminders, each sent once per period (stamped on vendor_subscriptions), to
 * the shop and to its coordinator:
 *   week   — 1–7 days before period_end
 *   end    — on period_end
 *   lapsed — 1–3 days after period_end (then silence; a long-lapsed shop isn't nagged)
 * Lights-out shops are skipped. Safe to run any number of times a day.
 */
type Kind = "week" | "end" | "lapsed";
const STAMP: Record<Kind, "reminded_week_at" | "reminded_end_at" | "reminded_lapsed_at"> = {
  week: "reminded_week_at",
  end: "reminded_end_at",
  lapsed: "reminded_lapsed_at",
};

function daysUntil(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

export async function runSubscriptionReminders(admin: SupabaseClient, today = new Date().toISOString().slice(0, 10)) {
  const counts = { today, week: 0, end: 0, lapsed: 0, no_period: 0 };
  const settings = await loadSplitSettings(admin);
  const fee = formatMoney(settings.subscription_fee_cents, "USD");

  const { data: shops } = await admin
    .from("vendors")
    .select("id, name, email, business_email, user_id, coordinator_user_id, currency, status, suspended_at")
    .not("coordinator_user_id", "is", null)
    .eq("status", "approved");
  const local = (shops ?? []).filter((v) => isLocalRail(v) && !v.suspended_at);
  if (!local.length) return counts;

  const { data: subs } = await admin
    .from("vendor_subscriptions")
    .select("id, vendor_id, period_end, reminded_week_at, reminded_end_at, reminded_lapsed_at")
    .in("vendor_id", local.map((v) => v.id))
    .order("period_end", { ascending: false });
  type Sub = NonNullable<typeof subs>[number];
  const latest = new Map<number, Sub>();
  for (const s of subs ?? []) if (!latest.has(Number(s.vendor_id))) latest.set(Number(s.vendor_id), s);

  const coordCache = new Map<string, { email: string | null; name: string | null }>();

  for (const v of local) {
    const s = latest.get(v.id);
    if (!s) { counts.no_period++; continue; }
    const left = daysUntil(today, s.period_end);
    let kind: Kind | null = null;
    if (left >= 1 && left <= 7 && !s.reminded_week_at) kind = "week";
    else if (left === 0 && !s.reminded_end_at) kind = "end";
    else if (left < 0 && left >= -3 && !s.reminded_lapsed_at) kind = "lapsed";
    if (!kind) continue;

    const coordId = v.coordinator_user_id as string;
    let coord = coordCache.get(coordId);
    if (!coord) {
      const { data: p } = await admin.from("festdash_promoters").select("display_name").eq("user_id", coordId).maybeSingle();
      coord = { email: await userEmailById(admin, coordId), name: p?.display_name ?? null };
      coordCache.set(coordId, coord);
    }
    const shopName = v.name ?? `Vendor #${v.id}`;
    const coordName = coord.name ?? "your coordinator";
    const shopTo = v.email || v.business_email || (await userEmailById(admin, v.user_id));

    const copy =
      kind === "week"
        ? {
            subject: `Your FestDash listing fee is due by ${s.period_end}`,
            heading: "Listing fee due soon",
            shop: `Your shop's paid period ends on ${s.period_end}. Pay the next month's fee (${fee}, in your local currency) to ${coordName} before then and your shop stays on FestDash without a gap.`,
            coord: `${shopName}'s paid period ends on ${s.period_end}. Collect the next fee (${fee}) and log it in your purse console to keep them listed.`,
            inapp: `Listing fee due by ${s.period_end} — pay ${coordName} to stay on FestDash.`,
          }
        : kind === "end"
          ? {
              subject: "Your FestDash listing fee is due today",
              heading: "Last day of your paid period",
              shop: `Today is the last day of your shop's paid period. From tomorrow it is hidden from FestDash until ${coordName} logs the next fee (${fee}).`,
              coord: `Today is the last day of ${shopName}'s paid period. Collect and log the next fee today to avoid a gap.`,
              inapp: "Last day of your paid period — pay your coordinator to stay listed.",
            }
          : {
              subject: "Your shop is hidden from FestDash until the next fee is logged",
              heading: "Listing paused",
              shop: `Your shop's paid period ended on ${s.period_end}, so it is hidden from FestDash for now. Pay the next month's fee (${fee}) to ${coordName}; the moment it is logged, you're back on.`,
              coord: `${shopName}'s paid period ended on ${s.period_end} and the shop is now hidden. Collect and log the next fee to bring it back.`,
              inapp: `Hidden from FestDash since ${s.period_end} — pay your coordinator to come back.`,
            };

    await Promise.allSettled([
      emailUser(shopTo, copy.subject, {
        heading: copy.heading,
        intro: copy.shop,
        rows: [["Paid through", s.period_end], ["Coordinator", coordName]],
        cta: { label: "See your shop's status", path: "/festdash/shop-setup" },
      }),
      notifyUserInApp(admin, v.user_id, `shop_fee_${kind}`, copy.inapp, "/festdash/shop-setup"),
      emailUser(coord.email, kind === "lapsed" ? `${shopName} is hidden — fee lapsed` : `${shopName} — listing fee due`, {
        heading: kind === "lapsed" ? `${shopName} is hidden` : `${shopName}: fee due`,
        intro: copy.coord,
        rows: [["Shop", shopName], ["Paid through", s.period_end]],
        cta: { label: "Open the purse console", path: "/festdash/purse" },
      }),
      notifyUserInApp(admin, coordId, `coordinator_fee_${kind}`, copy.coord, "/festdash/purse"),
    ]);
    await admin.from("vendor_subscriptions").update({ [STAMP[kind]]: new Date().toISOString() }).eq("id", s.id);
    counts[kind]++;
  }
  return counts;
}
