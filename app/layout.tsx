import Link from "next/link";
import "./globals.css";
import { NavBar } from "./components/NavBar";
import { WaveField } from "./components/WaveField";
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

export const metadata = {
  metadataBase: new URL("https://northedm.com"),
  title: {
    default: "NorthEDM — Unite the Northeast",
    template: "%s | NorthEDM",
  },
  description:
    "NorthEDM is the hub for Appalachian festival culture, Northeast EDM community, mushroom foraging tours, a vendor marketplace, and Wook World. Join the movement.",
  keywords: [
    "NorthEDM",
    "Northeast EDM",
    "festival community",
    "mushroom foraging",
    "Appalachian culture",
    "electronic music northeast",
    "EDM marketplace",
    "wook world",
    "foraging tours",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://northedm.com",
    siteName: "NorthEDM",
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian-rooted festival culture, Northeast EDM community, mushroom foraging, vendor marketplace, and Wook World.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian-rooted festival culture, Northeast EDM community, mushroom foraging, vendor marketplace, and Wook World.",
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
        <WaveField />
        <div style={{ position: "relative", zIndex: 1 }}>
        <header className="sticky top-0 z-30" style={{ position: "sticky", background: "rgba(3,3,3,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
          {/* Spectral gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 0%, #39FF14 18%, #00D4FF 50%, #CC00FF 82%, transparent 100%)" }} />
          {/* Stage-light aura */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 35% 180% at 18% 120%, rgba(57,255,20,0.09) 0%, transparent 65%), radial-gradient(ellipse 35% 180% at 50% 120%, rgba(0,212,255,0.07) 0%, transparent 65%), radial-gradient(ellipse 35% 180% at 82% 120%, rgba(204,0,255,0.09) 0%, transparent 65%)" }} />
          <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="block shrink-0">
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
            </Link>

            <NavBar userId={user?.id ?? null} showAdmin={showAdmin ?? false} showVendorDash={hasVendor} />
          </div>
        </header>


        {children}
        </div>
      </body>
    </html>
  );
}
