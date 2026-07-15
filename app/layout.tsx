import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { NavBar } from "./components/NavBar";
import { WaveField } from "./components/WaveField";
import { PageViewTracker } from "./components/PageViewTracker";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { HoodieWelcome } from "./components/HoodieWelcome";
import { BugReporter } from "./components/BugReporter";
import { createClient } from "@/utils/supabase/server";
import { Bebas_Neue, DM_Sans, DM_Mono } from "next/font/google";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans-var",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono-var",
});

export const viewport = {
  themeColor: "#050506",
};

export const metadata = {
  metadataBase: new URL("https://northedm.com"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NorthEDM",
    statusBarStyle: "black-translucent" as const,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  verification: {
    google: "x2L3uWls2ZEHnlWxVQDu9HizLicmZKZg4GBJkfWkxq8",
  },
  title: {
    default: "NorthEDM — Unite the Northeast",
    template: "%s | NorthEDM",
  },
  description:
    "NorthEDM is the hub for Appalachian festival culture, Northeast EDM community, mushroom foraging tours, and a vendor marketplace. Join the movement.",
  keywords: [
    "NorthEDM",
    "Northeast EDM",
    "festival community",
    "mushroom foraging",
    "Appalachian culture",
    "electronic music northeast",
    "EDM marketplace",
    "foraging tours",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://northedm.com",
    siteName: "NorthEDM",
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian-rooted festival culture, Northeast EDM community, mushroom foraging, and vendor marketplace.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian-rooted festival culture, Northeast EDM community, mushroom foraging, and vendor marketplace.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let forumRole: string | null = null;
  let hasVendor = false;
  if (user) {
    const [{ data: userProfile }, { data: profileData }] = await Promise.all([
      supabase.from("user_profiles").select("role").eq("id", user.id).single(),
      supabase.from("profiles").select("vendor_id").eq("id", user.id).single(),
    ]);
    forumRole = userProfile?.role ?? null;
    hasVendor = !!profileData?.vendor_id;
  }

  const ADMIN_EMAIL = "cjblue27@gmail.com";
  const showAdmin =
    forumRole === "archon" ||
    forumRole === "warden" ||
    (user?.email === ADMIN_EMAIL);

  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="bg-[#030303] text-neutral-100">
        <Analytics />
        <PageViewTracker />
        <ServiceWorkerRegister />
        <HoodieWelcome />
        <BugReporter />
        <WaveField />
        <div style={{ position: "relative", zIndex: 1 }}>
        <header className="sticky top-0 z-30" style={{ position: "sticky", background: "rgba(3,3,3,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
          {/* Spectral gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 0%, #39FF14 18%, #00D4FF 50%, #CC00FF 82%, transparent 100%)" }} />
          {/* Stage-light aura */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 35% 180% at 18% 120%, rgba(57,255,20,0.09) 0%, transparent 65%), radial-gradient(ellipse 35% 180% at 50% 120%, rgba(0,212,255,0.07) 0%, transparent 65%), radial-gradient(ellipse 35% 180% at 82% 120%, rgba(204,0,255,0.09) 0%, transparent 65%)" }} />
          <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
            <Link
              href="/"
              aria-label="NorthEDM home"
              className="-ml-3 flex shrink-0 flex-col gap-1 rounded-xl px-3 py-2 transition hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/northedm-logo.svg"
                  alt="NorthEDM logo"
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0"
                />
                <div>
                  <div
                    className="font-bebas text-xl tracking-wide"
                    style={{
                      background: "linear-gradient(90deg, #39FF14 0%, #00D4FF 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 0 10px rgba(57,255,20,0.5)) drop-shadow(0 0 22px rgba(0,212,255,0.3))",
                    }}
                  >
                    NorthEDM
                  </div>
                  <div className="font-dm-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: "rgba(57,255,20,0.3)" }}>
                    Unite the Northeast
                  </div>
                </div>
              </div>
              {/* Brand footer line, beneath the whole mark */}
              <div className="font-dm-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: "rgba(57,255,20,0.3)" }}>
                Northeast Dance Music
              </div>
            </Link>

            <NavBar userId={user?.id ?? null} showAdmin={showAdmin ?? false} showVendorDash={hasVendor} />
          </div>
        </header>


        {children}

        <footer className="relative mt-24 border-t border-white/10">
          {/* Spectral gradient line */}
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 0%, #39FF14 18%, #00D4FF 50%, #CC00FF 82%, transparent 100%)" }} />
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/northedm-logo.svg" alt="NorthEDM logo" width={48} height={48} className="h-12 w-12 shrink-0" />
                  <div>
                    <div
                      className="font-bebas text-lg tracking-wide"
                      style={{
                        background: "linear-gradient(90deg, #39FF14 0%, #00D4FF 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      NorthEDM
                    </div>
                    <p className="font-dm-mono text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                      Unite the Northeast
                    </p>
                  </div>
                </div>
                <p className="mt-2 font-dm-mono text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                  Northeast Dance Music
                </p>
                <p className="mt-4 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-700">
                  FestDash™ / FestEats™
                </p>
                <div className="mt-4 space-y-1 text-sm text-neutral-400">
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Contact</p>
                  <p className="text-neutral-300">CJ Lewis</p>
                  <p><a href="tel:+15709514219" className="hover:text-white">570-951-4219</a></p>
                  <p><a href="mailto:northedm1@gmail.com" className="hover:text-white">northedm1@gmail.com</a></p>
                </div>
              </div>
              <div>
                <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Community</p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li><Link href="/forum" className="hover:text-white">Forum</Link></li>
                  <li><Link href="/crowdwave" className="hover:text-white">CrowdWave</Link></li>
                  <li><Link href="/feed" className="hover:text-white">Feed</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Platform</p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li><Link href="/marketplace" className="hover:text-white">Marketplace</Link></li>
                  <li><Link href="/shop" className="hover:text-white">Shop</Link></li>
                  <li><Link href="/vendors" className="hover:text-white">Vendors</Link></li>
                  <li><Link href="/foraging" className="hover:text-white">Foraging</Link></li>
                  <li><Link href="/festdash" className="hover:text-white">FestDash</Link></li>
                  <li><Link href="/portfolio" className="hover:text-white">Portfolio</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Account</p>
                <ul className="space-y-2 text-sm text-neutral-400">
                  <li><Link href="/signup" className="hover:text-white">Create Account</Link></li>
                  <li><Link href="/login" className="hover:text-white">Log In</Link></li>
                  <li><Link href="/feedback" className="hover:text-white">Feedback</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-dm-mono text-[10px] text-neutral-700">
                © {new Date().getFullYear()} NorthEDM LLC. All rights reserved. NorthEDM™, FestDash™,
                and FestEats™ are trademarks of NorthEDM LLC.
              </p>
              <div className="flex flex-wrap gap-4 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                <Link href="/privacy" className="hover:text-neutral-300">Privacy</Link>
                <Link href="/terms" className="hover:text-neutral-300">Terms</Link>
                <Link href="/feedback" className="hover:text-neutral-300">Contact</Link>
              </div>
            </div>
          </div>
        </footer>
        </div>
      </body>
    </html>
  );
}
