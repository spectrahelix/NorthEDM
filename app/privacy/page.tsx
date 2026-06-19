import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "How NorthEDM collects, uses, and protects your information.",
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

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">Legal</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Privacy Policy</h1>
        <p className="mt-2 font-dm-mono text-xs text-neutral-500">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-neutral-400">
          NorthEDM (&quot;we&quot;, &quot;us&quot;) operates the community hub, vendor marketplace, and
          FestDash delivery network at northedm.com. This policy explains what we collect, why, and
          your choices.
        </p>

        <Section title="Information we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><span className="text-neutral-300">Account info:</span> when you sign up with email or Google, we receive your name, email address, and (for Google) your profile picture. Passwords are handled by our auth provider and never stored by us in plain text.</li>
            <li><span className="text-neutral-300">Profile:</span> display name, bio, home city, avatar, and any cosmetic items you select.</li>
            <li><span className="text-neutral-300">FestDash orders:</span> to deliver to you, we collect your order, delivery window, campsite/landmark details, phone number, optional campsite/vehicle photos, and — only if you grant permission — a one-time GPS location to help your runner find you.</li>
            <li><span className="text-neutral-300">Payments:</span> card payments are processed by Stripe; we do not store full card numbers. We retain order totals, store-credit balances, and referral/commission records.</li>
            <li><span className="text-neutral-300">Usage:</span> anonymous, privacy-light analytics (page paths, an anonymous browser id, referrer) to understand site traffic. No third-party advertising trackers.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>To create and secure your account; operate the marketplace and FestDash deliveries; process payments and escrow; run referrals, store credit, and commission codes; send service and owner notifications; prevent abuse; and improve the site.</p>
        </Section>

        <Section title="When we share it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><span className="text-neutral-300">Vendors &amp; runners:</span> for a FestDash order, the assigned vendor and delivery runner receive the details needed to fulfill it (your name, delivery location, contact, and order).</li>
            <li><span className="text-neutral-300">Service providers:</span> Supabase (database/auth), Stripe (payments), Vercel (hosting/analytics), Google (sign-in), and ntfy (operator notifications). They process data only to provide their service.</li>
            <li><span className="text-neutral-300">Legal:</span> when required by law or to protect users and the platform.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </Section>

        <Section title="Google sign-in">
          <p>If you sign in with Google, we request only your basic profile (name, email, profile picture). Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>
        </Section>

        <Section title="Your choices &amp; rights">
          <p>You can edit your profile, and request access to or deletion of your account and associated data at any time from your account settings or by contacting us. Deleting your account removes your profile and personal data, subject to records we must retain for legal or financial reasons.</p>
        </Section>

        <Section title="Data retention &amp; security">
          <p>We keep personal data only as long as needed for the purposes above or as required by law, and we use industry-standard safeguards (encryption in transit, row-level access controls). No system is perfectly secure, but we work to protect your data.</p>
        </Section>

        <Section title="Children">
          <p>NorthEDM is not directed to children under 13, and we do not knowingly collect their data.</p>
        </Section>

        <Section title="Changes & contact">
          <p>We may update this policy; material changes will be posted here with a new date. Questions? Email <a className="text-[#3AFFD4] hover:underline" href="mailto:support@northedm.com">support@northedm.com</a>.</p>
        </Section>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm">
          <Link href="/terms" className="text-neutral-500 hover:text-neutral-300">Terms of Service →</Link>
        </div>
      </div>
    </main>
  );
}
