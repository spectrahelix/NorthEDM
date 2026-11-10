import Link from "next/link";

export const metadata = {
  title: "Promoter & Coordinator Agreement | NorthEDM",
  description: "NorthEDM LLC promoter and coordinator terms, including the 10% subscription commission, payment timing, and promotion rules.",
};

const SECTIONS = [
  {
    id: "participation",
    title: "1. Participation and approval",
    paragraphs: [
      "This agreement covers participation in NorthEDM LLC's promoter and regional coordinator programs and supplements the Terms of Service. By submitting a promoter application after the agreement notice, or otherwise expressly accepting these terms, you agree to them. Applying does not guarantee approval, referrals, sales, or income. You must be at least 18, able to enter the agreement, and provide accurate account and payout details.",
      "Promoter approval does not automatically authorize regional payment collection. Coordinator duties and any collection authority must be separately approved by NorthEDM. A promoter code identifies an eligible referral; it is not a right to collect money or represent yourself as an owner or employee of NorthEDM.",
    ],
  },
  {
    id: "subscription-commission",
    title: "2. Subscription commission: the promoter keeps 10%",
    paragraphs: [
      "For an eligible paid shop subscription attributed to you, the standard promoter or coordinator share is 10% of the subscription amount actually paid. NorthEDM receives the remaining 90%, before payment-provider costs. On a $30.00 subscription payment, the promoter keeps $3.00 and NorthEDM receives $27.00. The $27.00 is NorthEDM's share.",
      "Discounts reduce the amount on which the subscription commission is calculated. If a discount reduces a $30.00 subscription to $27.00, the promoter earns $2.70 and NorthEDM receives $24.30. At the same 10% rate, a $45.00 bundle payment allocates $4.50 to the promoter and $40.50 to NorthEDM. Amounts are recorded in the payment currency's minor units; fractional-unit rounding follows the applicable payment ledger.",
      "A customer discount is separate from your commission. The subscription commission does not give you a shop's product-sale proceeds or runner fees. Product sales, service referrals, and other eligible activities have their own disclosed rates and requirements. These subscription commissions arise from eligible paid subscriptions, not merely recruiting another promoter. No payment means no subscription commission.",
      "Attribution follows the accepted code or shop referral recorded for the subscription. Only one promoter or coordinator share applies to the same subscription payment. An eligible renewal can earn another commission when it is paid. NorthEDM does not pay a separate promoter commission to its own owner account. Any different future rate must be disclosed for the affected activity before it applies; earned amounts are not reduced retroactively by changing a setting.",
    ],
  },
  {
    id: "payouts",
    title: "3. Recorded earnings and payout timing",
    paragraphs: [
      "A card-paid commission is recorded after the relevant payment is confirmed. Recording an amount does not mean it has already reached your bank or wallet. Card commissions remain subject to the applicable refund-protection hold, payment verification, and payout-provider requirements. The standard protection window is 30 days unless a different window is disclosed for the activity. Provider processing and bank transfer time can add further delay.",
      "You must complete any supported payout setup and verification needed for your destination. Where NorthEDM has approved a manual payout arrangement, such as Remitly for an unsupported region, the transfer is handled separately and its confirmation is recorded. A pending ledger entry is not a bank account, withdrawable wallet, or promise of an instant transfer. Ask northedm1@gmail.com about a missing or incorrect payment.",
      "Refunds, chargebacks, failed payments, fraud, and duplicate attribution can reduce or reverse the commission associated with the affected transaction, subject to applicable law. NorthEDM may reconcile a documented overpayment and will explain disputed adjustments. Ending participation does not erase valid accrued payment obligations.",
    ],
  },
  {
    id: "coordinator-collection",
    title: "4. Authorized local collection and settlement",
    paragraphs: [
      "Collect locally only when NorthEDM has approved that role and the payment method is currently enabled for the transaction. Do not substitute a personal payment request for the checkout instructions. Where a coordinator is authorized to collect a $30.00 subscription fee locally at the standard rate, the coordinator retains $3.00 and accounts for $27.00 owed to NorthEDM. If NorthEDM collects the card payment, NorthEDM records the $3.00 commission payable to the eligible promoter or coordinator instead.",
      "New FestDash orders using secure handoff require provider-held card payments. Do not collect those order payments in a personal wallet or treat a single party's confirmation as authorization to release money. The customer and assigned Dasher, or pickup shop operator, each confirm using the other person's private random code before capture and settlement begin. Failed orders release an uncaptured hold or require a refund of a captured payment, subject to provider processing. This order-payment rule is separate from your 10% share of eligible subscription payments.",
      "Keep accurate receipts, transaction references, currencies, dates, and settlement records. Confirm a payment only after verifying receipt. Account for shop, runner, and NorthEDM amounts separately from your commission. Follow the approved settlement instructions; never retain another party's share as your own earnings. Cross-currency conversion, transfer charges, and settlement arrangements must be disclosed and agreed before collection. Regional laws and provider restrictions still apply; this agreement does not grant a financial-services licence.",
    ],
  },
  {
    id: "promotion-rules",
    title: "5. Honest promotion and disclosures",
    paragraphs: [
      "Clearly disclose your compensated relationship wherever you recommend NorthEDM or share a commission-earning code. Use plain words close to the recommendation, such as: I may earn a commission if you buy through my code. A profile-only notice or an unexplained affiliate label may be insufficient. Follow the advertising rules that apply to your audience, including the FTC's endorsement guidance for promotions reaching U.S. consumers.",
      "Make truthful claims and use only branding or materials you are authorized to use. Do not promise guaranteed earnings, invent customer experiences, make unsupported health claims, send unlawful unsolicited messages, manipulate referrals, or misrepresent discounts. Do not change NorthEDM's prices, bind NorthEDM to a contract, collect an undisclosed fee, or offer an unapproved payment method.",
    ],
  },
  {
    id: "responsibilities",
    title: "6. Responsibilities and ending participation",
    paragraphs: [
      "You are responsible for lawful promotion, required permissions, and taxes that apply to your compensation. NorthEDM may require information needed for lawful tax reporting or payout verification. These terms do not determine or waive employment, consumer, or other mandatory rights under applicable law.",
      "Either party may end participation. NorthEDM may suspend codes or collection authority for fraud, misuse, security risks, or a material breach, with notice and a way to raise an error where practical and lawful. Stop using revoked codes and collection authority when notified. Valid earned amounts, lawful adjustments, outstanding settlement duties, and rights that cannot be waived survive termination.",
    ],
  },
  {
    id: "changes-contact",
    title: "7. Changes, questions, and disputes",
    paragraphs: [
      "We will post a revised date and give appropriate advance notice of material changes, requesting renewed acceptance where required. Publishing a revision alone does not retroactively change a completed transaction or remove accrued rights. The Terms of Service address applicable law and dispute handling; mandatory local protections continue to apply.",
      "Contact NorthEDM LLC, Pennsylvania, United States, at northedm1@gmail.com. Include the subscription, invoice, or transaction reference when asking about a commission or settlement.",
    ],
  },
];

export default function PromoterTermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/promote" className="text-sm text-orange-300 hover:underline">← Promoter program</Link>
        <h1 className="mt-4 font-bebas text-4xl tracking-wide sm:text-5xl">Promoter &amp; Coordinator Agreement</h1>
        <p className="mt-3 font-dm-mono text-xs text-neutral-400">NorthEDM LLC · Effective November 10, 2026</p>

        <section aria-label="Subscription commission example" className="mt-8 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
          <p className="text-sm leading-7 text-neutral-300">Standard subscription commission: <strong className="text-white">10% to the promoter or coordinator</strong>.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[["Subscription paid", "$30.00"], ["Promoter keeps (10%)", "$3.00"], ["NorthEDM receives (90%)", "$27.00"]].map(([label, amount]) => (
              <div key={label} className="rounded-xl bg-black/30 p-4">
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">{amount}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-6 text-neutral-400">Example before payment-provider costs. Discounts reduce the paid amount and the commission base. Product-sale shares and runner fees are separate.</p>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="mt-10 scroll-mt-32">
            <h2 id={`${section.id}-heading`} className="mb-3 font-bebas text-2xl tracking-wide text-white">{section.title}</h2>
            <div className="space-y-3 text-sm leading-7 text-neutral-300">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            {section.id === "promotion-rules" && <p className="mt-3 text-sm"><a href="https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers" className="text-orange-300 underline underline-offset-4">FTC disclosure guidance</a></p>}
          </section>
        ))}

        <div className="mt-10 flex flex-wrap gap-5 border-t border-white/10 pt-6 text-sm text-orange-300">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <a href="mailto:northedm1@gmail.com" className="hover:underline">Contact NorthEDM LLC</a>
        </div>
      </div>
    </main>
  );
}
