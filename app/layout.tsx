import Link from "next/link";
import "./globals.css";
import SignOutButton from "./components/SignOutButton";
import { NotificationBell } from "./components/NotificationBell";
import { MessagesNavLink } from "./components/MessagesBadge";
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

  // Get forum role for nav logic
  let forumRole: string | null = null;
  if (user) {
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    forumRole = userProfile?.role ?? null;
  }

  const isForumAdmin =
    forumRole === "archon" || forumRole === "warden";

  // Also check legacy email-based admin
  const ADMIN_EMAIL = "cjblue27@gmail.com";
  const isLegacyAdmin = user?.email === ADMIN_EMAIL;
  const showAdmin = isForumAdmin || isLegacyAdmin;

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

            <nav className="flex items-center gap-4 text-sm text-neutral-300">
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
              <Link href="/marketplace" className="transition hover:text-white">
                Marketplace
              </Link>
              <Link href="/vendors" className="transition hover:text-white">
                Vendors
              </Link>
              <Link href="/foraging" className="transition hover:text-white">
                Foraging
              </Link>
              <Link href="/feed" className="transition hover:text-white">
                Feed
              </Link>
              <Link
                href="/forum"
                className="rounded-full bg-[#E8FF47]/10 px-3 py-1 text-[#E8FF47] transition hover:bg-[#E8FF47]/20"
              >
                Forum
              </Link>

              {user ? (
                <>
                  <MessagesNavLink userId={user.id} />

                  <NotificationBell userId={user.id} />

                  <Link
                    href={`/profile/${user.id}`}
                    className="transition hover:text-white"
                  >
                    Profile
                  </Link>

                  {showAdmin && (
                    <Link
                      href="/admin"
                      className="font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]/80 transition hover:text-[#FF5C3A]"
                    >
                      Admin
                    </Link>
                  )}

                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/signup" className="transition hover:text-white">
                    Signup
                  </Link>
                  <Link href="/login" className="transition hover:text-white">
                    Login
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
