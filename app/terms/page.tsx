import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using NorthEDM, its marketplace, and FestDash.",
};

const UPDATED = "June 19, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-bebas text-2xl tracking-wide text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-neutral-400">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">Legal</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Terms of Service</h1>
        <p className="mt-2 font-dm-mono text-xs text-neutral-500">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-neutral-400">
          These terms govern your use of NorthEDM, operated by NorthEDM LLC (northedm.com), including
          the community hub, vendor marketplace, and the FestDash delivery network. By using the site
          you agree to them.
        </p>

        <Section title="Accounts">
          <p>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. We may suspend or remove accounts that violate these terms or harm the community.</p>
        </Section>

        <Section title="Marketplace & vendors">
          <p>NorthEDM is a platform connecting customers with independent vendors. Vendors are responsible for their own products, listings, pricing, fulfillment, and compliance with applicable law. NorthEDM is not the seller of vendor products unless explicitly stated.</p>
        </Section>

        <Section title="FestDash orders & delivery">
          <p>FestDash lets you order from a festival vendor for delivery to your campsite. Orders may be prepaid and held in escrow until delivery is confirmed by the 4-digit code (the last four digits of your phone). You agree to provide accurate delivery details. Availability, delivery windows, and runner coverage are not guaranteed.</p>
        </Section>

        <Section title="Store credit, referrals & commission codes">
          <p>Store credit and referral rewards have no cash value, are non-transferable, are not redeemable for cash, and may expire or be revoked for abuse. Commission codes apply discounts at checkout as described at the time of use. We may adjust or discontinue these programs at any time.</p>
        </Section>

        <Section title="Payments">
          <p>Payments are processed by Stripe and subject to their terms. You authorize the applicable charges, including any platform fees disclosed at checkout. Refunds, where offered, follow the policy shown for the relevant order or vendor.</p>
        </Section>

        <Section title="Acceptable use">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>No unlawful, harmful, fraudulent, or abusive activity.</li>
            <li>No attempts to break, scrape, overload, or gain unauthorized access to the platform.</li>
            <li>No posting of content you don&apos;t have the right to share, or that is hateful, harassing, or illegal.</li>
          </ul>
        </Section>

        <Section title="Disclaimers & liability">
          <p>The service is provided &quot;as is&quot; without warranties of any kind. To the maximum extent permitted by law, NorthEDM is not liable for indirect or consequential damages, or for the acts of vendors, runners, or other users. Nothing here limits liability that cannot be limited by law.</p>
        </Section>

        <Section title="Termination">
          <p>You may stop using the service and delete your account at any time. We may suspend or terminate access for violations of these terms.</p>
        </Section>

        <Section title="Changes & contact">
          <p>We may update these terms; material changes will be posted here with a new date. Questions? Email <a className="text-[#3AFFD4] hover:underline" href="mailto:support@northedm.com">support@northedm.com</a>.</p>
        </Section>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm">
          <Link href="/privacy" className="text-neutral-500 hover:text-neutral-300">Privacy Policy →</Link>
        </div>
      </div>
    </main>
  );
}
