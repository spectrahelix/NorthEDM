import Link from "next/link";
import "./globals.css";
import SignOutButton from "./components/SignOutButton";
import { createClient } from "@/utils/supabase/server";

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

  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">
        <header className="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="block">
              <div className="text-xl font-semibold tracking-wide">NorthEDM</div>
              <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                Unite the Northeast
              </div>
            </Link>

            <nav className="flex items-center gap-4 text-sm text-neutral-300">
  <Link href="/" className="hover:text-white">
    Home
  </Link>
  <Link href="/marketplace" className="hover:text-white">
     Marketplace
  </Link>
  <Link href="/vendors" className="hover:text-white">
  Vendors
</Link>
  <Link href="/foraging" className="hover:text-white">
    Foraging
  </Link>

  <Link href="/requests" className="hover:text-white">
    Requests
  </Link>

  <Link href="/wook-world" className="hover:text-white">
    Wook World
  </Link>

  {user ? (
    <>
      <Link href="/admin" className="hover:text-white">
        Admin
      </Link>
      <SignOutButton />
    </>
  ) : (
    <>
      <Link href="/signup" className="hover:text-white">
        Signup
      </Link>
      <Link href="/login" className="hover:text-white">
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