import Link from "next/link";
import "./globals.css";
import { NavBar } from "./components/NavBar";
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
  title: "NorthEDM",
  description: "Unite the Northeast",
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
  if (user) {
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    forumRole = userProfile?.role ?? null;
  }

  const ADMIN_EMAIL = "cjblue27@gmail.com";
  const showAdmin =
    forumRole === "archon" ||
    forumRole === "warden" ||
    user?.email === ADMIN_EMAIL;

  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="bg-neutral-950 text-neutral-100">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="block shrink-0">
              <div className="font-bebas text-xl tracking-wide">NorthEDM</div>
              <div className="font-dm-mono text-[9px] uppercase tracking-[0.3em] text-neutral-500">
                Unite the Northeast
              </div>
            </Link>

            <NavBar userId={user?.id ?? null} showAdmin={showAdmin ?? false} />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
