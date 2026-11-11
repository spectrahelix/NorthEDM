import Link from 'next/link';
import { AudioPurchases } from '@/app/components/AudioPurchases';
export const metadata = { title: 'My audio recordings' };
export default function AudioPurchasesPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-neutral-100">
    <h1 className="font-bebas text-4xl">My audio recordings</h1>
    <p className="mt-3 text-sm text-neutral-400">Sign in with the account used at checkout. Your license and downloads stay here even if a creator removes their portfolio listing.</p>
    <AudioPurchases />
    <p className="mt-8 text-sm"><Link href="/artisans" className="text-[#FFC93C] underline">Discover artisans</Link> · <a href="mailto:northedm1@gmail.com" className="text-[#FFC93C] underline">Get purchase support</a></p>
  </main>;
}
