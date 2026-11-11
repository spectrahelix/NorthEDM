import Link from "next/link";
import { STORE_SLOT_PLANS } from "@/utils/storePlans";

export const metadata = {
  title: "Terms of Service",
  description:
    "Terms for NorthEDM LLC's website, Android app, community, marketplace, FestDash, and paid plans.",
};

const EFFECTIVE_DATE = "November 11, 2026";

// Customer-facing terms from the saved LLC draft. Internal publication
// notes and research references are not part of the agreement.
const SECTIONS = [
  {
    "id": "scope",
    "title": "1. Scope and agreement",
    "paragraphs": [
      "These Terms of Service govern the NorthEDM website at northedm.com, its Android app, and related community, marketplace, delivery, booking, and digital-tool features (the \"Service\"), operated by NorthEDM LLC (\"NorthEDM,\" \"we,\" and \"us\").",
      "You agree to these Terms when you accept them through a clearly identified acceptance control, or take an action after receiving clear notice that the action indicates agreement. If you do not agree, do not create an account or use the affected feature. A separate agreement or checkout disclosure may provide additional terms for a particular transaction. Mandatory consumer rights always apply."
    ]
  },
  {
    "id": "eligibility",
    "title": "2. Eligibility and accounts",
    "paragraphs": [
      "You must be at least 13, or the higher minimum age required where you live, to create an account. If you are under 18, a parent or legal guardian must review these Terms and authorize your use. Selling, operating a shop, delivering orders, entering a paid commercial program, or entering an agreement on behalf of a business requires age 18 or older and legal authority to do so.",
      "Provide accurate account and transaction information, protect your sign-in credentials, and promptly report suspected unauthorized access. Do not impersonate another person, share an account to evade restrictions, or misrepresent your qualifications. You are responsible for activity you authorize; this does not make you automatically liable for unauthorized transactions or waive rights provided by law."
    ]
  },
  {
    "id": "community",
    "title": "3. Community standards and reporting",
    "paragraphs": [
      "Treat other people respectfully. Do not post or send threats, harassment, bullying, hateful abuse, stalking, private information without permission, pornography, nonconsensual intimate imagery, or content exploiting or endangering children. Do not commit fraud, impersonate others, manipulate reviews, send spam, or promote unlawful sales or distribution of controlled substances.",
      "Do not list stolen, counterfeit, recalled, prohibited, or unlawfully supplied goods; infringe intellectual-property rights; make deceptive health or product claims; upload malware; bypass access controls; or intentionally disrupt the Service. Use available report and block controls, or contact us, to report concerns. We may review reports, remove content, restrict accounts, and cooperate with lawful requests. Moderation does not guarantee that every harmful post will be detected."
    ]
  },
  {
    "id": "your-content",
    "title": "4. Your content and our limited permission to use it",
    "paragraphs": [
      "You retain ownership of your posts, photographs, listings, messages, and other submissions. You must have the rights and permissions needed to share them. You give NorthEDM a nonexclusive, worldwide, royalty-free permission to host, store, back up, format, transmit, moderate, and display your content only as reasonably needed to operate and promote the features in which you chose to publish it, consistent with your audience settings and the Privacy Policy.",
      "Private messages and nonpublic submissions are not licensed for unrelated public advertising. Deleting content ends permission for future public use, subject to necessary processing, lawful retention, backups, and copies other users already received or shared. Contact us with sufficient details if you believe material infringes your rights."
    ]
  },
  {
    "id": "marketplace",
    "title": "5. Marketplace and seller responsibilities",
    "paragraphs": [
      "NorthEDM connects customers with shops, makers, service providers, and delivery participants. The listing, storefront, or receipt should identify the seller responsible for the transaction. For goods sold by NorthEDM itself, NorthEDM is the seller and retains the responsibilities that the law places on that seller. Displaying an independent vendor does not by itself make NorthEDM the manufacturer or seller of that vendor's goods.",
      "Sellers must accurately describe their goods and services, prices, available quantities, ingredients and allergens where relevant, fulfillment options, and return restrictions. Sellers are responsible for applicable permits, product safety, labeling, tax obligations, lawful sourcing, and fulfillment. Any shop or listing approval is permission to use the platform, not a guarantee of safety, quality, licensing, or suitability."
    ]
  },
  {
    "id": "payments",
    "title": "6. Orders, prices, fees, and payments",
    "paragraphs": [
      "Review the seller, items, quantities, currency, fulfillment method, and total before ordering. Applicable delivery, service, shipping, processing, transfer, and tax amounts must be disclosed before you authorize payment. Currency-conversion estimates are informational; your payment provider may set a different rate or charge a disclosed conversion fee.",
      "Card payments are handled by payment providers such as Stripe. Depending on the transaction, a card may be charged at purchase or temporarily authorized and captured after fulfillment. An authorization hold reserves available funds; it is not a customer deposit account or a promise of a separate escrow service. Release and refund posting times depend on the provider and applicable law.",
      "Use only the payment methods and payment instructions actually presented for your order. Regional payment options may differ. Do not send funds to a number or account supplied in an unsolicited message. A booking request, cart entry, payment reference, or automated acknowledgment alone does not guarantee acceptance, stock, or completed payment. If an order cannot be accepted, any charge or hold must be addressed as required by law."
    ]
  },
  {
    "id": "festdash",
    "title": "7. FestDash pickup and delivery",
    "paragraphs": [
      "FestDash supports participating shops and locations where pickup or delivery is available. Provide accurate contact information, landmarks, access instructions, and any location information you choose to share. Availability, estimated arrival times, coverage, and walking routes can change because of weather, access restrictions, safety, stock, or runner availability.",
      "Be available for the agreed handover and follow reasonable venue and safety instructions. Only provide a delivery or collection confirmation code when you receive the order. Confirmation may trigger payment capture or settlement, but does not waive a valid complaint, statutory refund, or payment dispute. Report a missing or incorrectly marked delivery promptly with the order reference. Do not use FestDash for emergency, medical, or time-critical rescue needs."
    ]
  },
  {
    "id": "returns",
    "title": "8. Shipping, cancellations, returns, and disputes",
    "paragraphs": [
      "The seller must disclose material shipping, cancellation, and return terms before purchase. A restriction for perishable, custom-made, or hygiene-sensitive goods must be clearly disclosed and lawful. A policy cannot remove remedies for defective, misdescribed, undelivered, or otherwise legally nonconforming goods.",
      "If shipment cannot occur within the promised period, the seller must provide the delay notice, cancellation opportunity, consent process, or refund required by applicable law. Canceling an authorization releases a hold; refunding a completed charge is a different process. Bank posting times vary. Contact the seller or NorthEDM with your order reference and concern. You retain applicable rights to contact your payment provider, regulator, or court; a delivery code or \"final sale\" label does not erase those rights."
    ]
  },
  {
    "id": "subscriptions",
    "title": "9. Subscriptions, billing, and passes",
    "paragraphs": [
      "New card-paid store plans are available in the sizes shown below. Each slot covers one product listing in that storefront, including its size options. Selected listings still use a slot when sold out. You can change your selection in Manage store and keep other products in your inventory.",
      "Your existing subscription price and access continue under the terms you accepted. To choose a different monthly card tier, cancel future renewal through Manage billing and select the new tier after the paid period ends. Before choosing a smaller plan, save a storefront selection that fits its limit. New card-paid FestDash and Store bundles include a 30-slot storefront. Coordinator-collected fee arrangements follow their agreed terms.",
      "Paid shop and listing plans may renew automatically only under the price, renewal frequency, and other material terms presented when you enroll and expressly authorize recurring billing. Promotional pricing must identify the later recurring price before consent. A change to recurring charges requires appropriate advance disclosure and any consent required by law.",
      "You can cancel future renewals through Manage billing on the relevant shop or vendor dashboard. If that control is unavailable or does not work, contact northedm1@gmail.com for cancellation assistance. A valid cancellation must be honored under applicable law; uninstalling the app alone is not cancellation. The disclosed plan terms determine remaining paid-period access and any refund, subject to mandatory rights. Failed payments may suspend paid features.",
      "A one-time FestDash pass lasts for the period shown when purchased. It does not renew automatically unless a separate recurring offer is clearly presented and accepted. Any waived fee or benefit applies only as described in that offer."
    ]
  },
  {
    "id": "promotions",
    "title": "10. Credits, discounts, referrals, and commissions",
    "paragraphs": [
      "A discount, voucher, or promotional credit is subject to the conditions disclosed when issued, including eligible purchases, limits, and any lawful expiration. Promotional credit is not a bank balance, investment, or generally redeemable cash balance, except where law requires otherwise. We may address fraud or duplicate use without retroactively removing lawful, completed benefits.",
      "For an eligible shop subscription attributed to a promoter or coordinator, the standard commission is 10% of the subscription amount actually paid. A $30.00 payment allocates $3.00 to the promoter or coordinator and $27.00 to NorthEDM before payment-provider costs. A discount reduces the commission base: a $27.00 payment allocates $2.70 to the promoter or coordinator and $24.30 to NorthEDM. This subscription commission is separate from a shop's share of product sales, customer discounts, and runner fees. The Promoter and Coordinator Agreement explains eligibility, collection, payment timing, and adjustments.",
      "Earned cash commissions are distinct from promotional credits. Promoter and coordinator compensation, eligibility, reversals, payout timing, and payment-provider requirements are governed by the applicable written program terms. No referral code guarantees income. Anyone promoting a compensated relationship must make a clear disclosure where the promotion appears. Participation does not authorize someone to bind NorthEDM, change its prices, collect an undisclosed fee, or receive payments outside an authorized arrangement."
    ]
  },
  {
    "id": "foraging",
    "title": "11. Events, bookings, foraging, and products",
    "paragraphs": [
      "Event dates, forecasts, venue information, and third-party listings can change. Verify critical details with the organizer. A foraging or service booking is a request until the provider confirms the date, meeting details, price or contribution policy, and applicable cancellation terms. A separate activity agreement or lawful waiver may be required before participation.",
      "Outdoor activities can involve uneven terrain, adverse weather, ticks, allergens, and other hazards. Follow the guide's instructions and disclose relevant participation or accessibility needs directly to the provider. Children must be appropriately supervised. Do not consume a wild mushroom or plant solely because of a photograph, forum post, app result, or online suggestion; obtain reliable identification and preparation guidance from a qualified person. Product descriptions are not a diagnosis, prescription, or guarantee of a health outcome."
    ]
  },
  {
    "id": "tools",
    "title": "12. Calculators and informational tools",
    "paragraphs": [
      "Tools, generated reports, educational content, and cultural or spiritual interpretations are provided for information and reflection. Astrology and numerology interpretations are not scientifically established predictions or professional advice. Outputs depend on the inputs and methods used and can contain errors. Verify important results independently and do not rely on them for medical, legal, financial, safety, or other consequential decisions. Only enter another person's personal information when you have appropriate permission or another lawful basis."
    ]
  },
  {
    "id": "privacy",
    "title": "13. Privacy, device permissions, and service messages",
    "paragraphs": [
      "The Privacy Policy explains personal-data practices and available choices. Optional device permissions, including customer location sharing, should be granted only through the relevant notice and controls; turning them off can affect features that need them. Account, order, security, and billing messages may be needed to provide the Service. Accepting these Terms is not blanket consent to unrelated marketing and does not waive privacy rights."
    ]
  },
  {
    "id": "platform-materials",
    "title": "14. Platform materials and external services",
    "paragraphs": [
      "NorthEDM and its licensors retain rights in the platform software, branding, and original materials, except for user-owned submissions and third-party materials. You may use the Service as offered for its intended purpose. Do not copy or misuse protected materials, misrepresent a partnership, or use NorthEDM branding to imply an endorsement without permission.",
      "Links, payment services, maps, app stores, and other third-party features may have their own terms. NorthEDM is not responsible for their independent content or operation, but remains responsible for its own representations and obligations. Obtaining the Android app through Google Play does not make Google the seller of a marketplace order or provider of a NorthEDM tour."
    ]
  },
  {
    "id": "responsibility",
    "title": "15. Availability, disclaimers, and responsibility",
    "paragraphs": [
      "We work to provide a useful Service, but do not promise uninterrupted availability, error-free information, a particular business result, or that every vendor, event, delivery, or feature will be available. Subject to applicable law and any express commitments, the platform is provided on an \"as available\" basis. These statements do not replace a seller's product warranties or mandatory consumer protections.",
      "To the extent permitted by law, NorthEDM excludes liability for indirect or consequential losses, such as lost profits, arising from use of the platform. NorthEDM is not automatically responsible for an independent participant's conduct merely because that participant uses the Service. Nothing in these Terms excludes or limits liability for fraud, willful misconduct, gross negligence, or any injury, loss, warranty, remedy, or responsibility that cannot lawfully be excluded or limited."
    ]
  },
  {
    "id": "account-closure",
    "title": "16. Suspension, closure, and outstanding obligations",
    "paragraphs": [
      "We may restrict a feature, remove content, or suspend an account for a material breach, fraud, unlawful activity, security risk, or harm to others. Where practical and lawful, we will give notice and a way to raise an error; urgent protective action may occur first. Restrictions do not erase lawful refund obligations, earned amounts, or other accrued rights.",
      "You may stop using the Service and request account and associated-data deletion through an available deletion control or by contacting us. Identify any active paid plan when requesting closure so future billing can be addressed. We may retain records where legally required or otherwise permitted as explained in the Privacy Policy. Terms intended to apply after closure, including outstanding payment duties, content permissions needed for lawful retention, and dispute provisions, continue to that extent."
    ]
  },
  {
    "id": "disputes",
    "title": "17. Disputes and applicable law",
    "paragraphs": [
      "For a concern, contact northedm1@gmail.com with enough information to investigate. We encourage practical resolution, but contacting us is not a condition that removes a statutory remedy or prevents you from meeting a legal filing deadline. Pennsylvania law governs these Terms to the extent permitted, without overriding mandatory protections that apply where you live. A court with lawful jurisdiction may hear a dispute. Nothing here restricts a nonwaivable right to seek relief locally or complain to a public authority."
    ]
  },
  {
    "id": "changes",
    "title": "18. Changes, interpretation, and contact",
    "paragraphs": [
      "When these Terms change, we will post a revised date and provide appropriate notice of material changes. We will request renewed acceptance where required. Changes will not retroactively alter an already completed transaction or remove an accrued right without a lawful basis. If a provision cannot be enforced, the remaining provisions continue as far as the law permits. A failure to enforce one provision once is not a permanent waiver.",
      "Contact: NorthEDM LLC, Pennsylvania, United States. Email: northedm1@gmail.com. Website: https://www.northedm.com. Privacy notice: https://www.northedm.com/privacy."
    ]
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">
          Legal
        </p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Terms of Service</h1>
        <p className="mt-2 font-dm-mono text-xs text-neutral-400">
          NorthEDM LLC · Effective {EFFECTIVE_DATE}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-neutral-300">
          These terms cover the NorthEDM website and Android app. Read the sections
          below for account use, community standards, purchases, delivery, and paid
          plans.
        </p>

        <nav
          aria-label="Terms contents"
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <h2 className="font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4]">
            On this page
          </h2>
          <ol className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-neutral-300 underline-offset-4 hover:text-[#3AFFD4] hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-heading`}
            className="mt-10 scroll-mt-32"
          >
            <h2
              id={`${section.id}-heading`}
              className="mb-3 font-bebas text-2xl tracking-wide text-white"
            >
              {section.title}
            </h2>
            <div className="space-y-3 text-sm leading-7 text-neutral-300">
              {section.id === "subscriptions" && (
                <table className="w-full max-w-md border-collapse text-left">
                  <caption className="mb-2 text-left font-semibold text-white">Monthly store plans</caption>
                  <thead><tr className="border-b border-white/15"><th scope="col" className="px-2 py-1">Product slots</th><th scope="col" className="px-2 py-1">Monthly price in USD</th></tr></thead>
                  <tbody>{STORE_SLOT_PLANS.map(plan => <tr key={plan.slots} className="border-b border-white/10"><th scope="row" className="px-2 py-1 font-normal">{plan.slots}</th><td className="px-2 py-1">${(plan.cents / 100).toFixed(2)}</td></tr>)}</tbody>
                </table>
              )}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.id === "promotions" && (
                <p><Link href="/promote/terms" className="text-[#3AFFD4] underline underline-offset-4">Read the Promoter and Coordinator Agreement →</Link></p>
              )}
              {section.id === "your-content" && <p><Link href="/audio/terms" className="text-[#3AFFD4] underline underline-offset-4">Audio portfolio, purchase and seller terms →</Link></p>}
            </div>
          </section>
        ))}

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm">
          <Link href="/privacy" className="text-[#3AFFD4] hover:underline">
            Privacy Policy →
          </Link>
          <a href="mailto:northedm1@gmail.com" className="text-[#3AFFD4] hover:underline">
            Contact NorthEDM LLC
          </a>
        </div>
      </div>
    </main>
  );
}
