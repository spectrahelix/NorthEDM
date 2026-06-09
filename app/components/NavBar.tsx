"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { NotificationBell } from "./NotificationBell";
import { MessagesNavLink } from "./MessagesBadge";

const NAV_LINKS = [
  { href: "/",            label: "Home" },
  { href: "/forum",       label: "Forum",       highlight: true },
  { href: "/feed",        label: "Feed" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/vendors",     label: "Vendors" },
  { href: "/foraging",    label: "Foraging" },
];

export function NavBar({
  userId,
  showAdmin,
  showVendorDash = false,
}: {
  userId: string | null;
  showAdmin: boolean;
  showVendorDash?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* ── Desktop nav ───────────────────────────────────────── */}
      <nav className="hidden items-center gap-4 text-sm text-neutral-300 lg:flex">
        {NAV_LINKS.map((l) =>
          l.highlight ? (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full bg-[#E8FF47]/10 px-3 py-1 text-[#E8FF47] transition hover:bg-[#E8FF47]/20"
            >
              {l.label}
            </Link>
          ) : (
            <Link key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </Link>
          )
        )}

        {userId ? (
          <>
            <MessagesNavLink userId={userId} />
            <NotificationBell userId={userId} />
            <Link href={`/profile/${userId}`} className="transition hover:text-white">
              Profile
            </Link>
            {showVendorDash && (
              <Link
                href="/vendor"
                className="font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4]/80 transition hover:text-[#3AFFD4]"
              >
                My Shop
              </Link>
            )}
            {showAdmin && (
              <Link
                href="/admin"
                className="font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]/80 transition hover:text-[#FF5C3A]"
              >
                Admin
              </Link>
            )}
            <button
              onClick={signOut}
              className="rounded-2xl border border-white/15 px-4 py-1.5 text-sm transition hover:bg-white/5"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/signup" className="transition hover:text-white">Signup</Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/15 px-4 py-1.5 transition hover:bg-white/5"
            >
              Log In
            </Link>
          </>
        )}
      </nav>

      {/* ── Mobile right-side icons + hamburger ───────────────── */}
      <div className="flex items-center gap-3 lg:hidden">
        {userId && (
          <>
            <MessagesNavLink userId={userId} />
            <NotificationBell userId={userId} />
          </>
        )}
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-neutral-300 transition hover:bg-white/5 hover:text-white"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect y="0"  width="18" height="2" rx="1" fill="currentColor" />
            <rect y="6"  width="13" height="2" rx="1" fill="currentColor" />
            <rect y="12" width="8"  height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ── Mobile drawer — portaled to body so backdrop-blur on header can't trap it ── */}
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[9999] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-neutral-950 shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="font-bebas text-xl tracking-wide">NorthEDM</p>
                <p className="font-dm-mono text-[9px] uppercase tracking-[0.3em] text-neutral-600">
                  Unite the Northeast
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white/5 hover:text-white"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Links */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* Main nav links */}
              <div className="px-3">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`flex items-center rounded-xl px-4 py-3.5 text-base font-medium transition ${
                      l.highlight
                        ? "my-1 bg-[#E8FF47]/10 text-[#E8FF47] hover:bg-[#E8FF47]/20"
                        : "text-neutral-200 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-white/10" />

              {/* Auth links */}
              <div className="px-3">
                {userId ? (
                  <>
                    <Link
                      href={`/profile/${userId}`}
                      className="flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-neutral-200 transition hover:bg-white/5 hover:text-white"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/messages"
                      className="flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-neutral-200 transition hover:bg-white/5 hover:text-white"
                    >
                      Messages
                    </Link>
                    {showVendorDash && (
                      <Link
                        href="/vendor"
                        className="flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-[#3AFFD4]/80 transition hover:bg-[#3AFFD4]/5 hover:text-[#3AFFD4]"
                      >
                        My Shop
                      </Link>
                    )}
                    {showAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-[#FF5C3A]/80 transition hover:bg-[#FF5C3A]/5 hover:text-[#FF5C3A]"
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={signOut}
                      className="mt-2 flex w-full items-center rounded-xl px-4 py-3.5 text-base font-medium text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="flex items-center justify-center rounded-xl bg-[#E8FF47] px-4 py-3.5 text-base font-semibold text-black transition hover:opacity-90"
                    >
                      Create Account
                    </Link>
                    <Link
                      href="/login"
                      className="mt-2 flex items-center rounded-xl px-4 py-3.5 text-base font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white"
                    >
                      Log In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
