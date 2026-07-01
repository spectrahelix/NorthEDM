"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { NotificationBell } from "./NotificationBell";
import { MessagesNavLink } from "./MessagesBadge";
import { GlobalSearch } from "./GlobalSearch";

type NavLink = {
  href: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  bold?: boolean;
};

const NAV_LINKS: NavLink[] = [
  {
    href: "/forum",
    label: "Forum",
    color: "#CC00FF",
    bg: "rgba(204,0,255,0.10)",
    border: "rgba(204,0,255,0.30)",
  },
  {
    href: "/feed",
    label: "Feed",
    color: "#00D4FF",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.28)",
  },
  {
    href: "/crowdwave",
    label: "CrowdWave",
    color: "#3AFFD4",
    bg: "rgba(58,255,212,0.08)",
    border: "rgba(58,255,212,0.28)",
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    color: "#39FF14",
    bg: "rgba(57,255,20,0.08)",
    border: "rgba(57,255,20,0.28)",
  },
  {
    href: "/shop",
    label: "Shop",
    color: "#E8FF47",
    bg: "rgba(232,255,71,0.08)",
    border: "rgba(232,255,71,0.28)",
  },
  {
    href: "/vendors",
    label: "Vendors",
    color: "#FF5C3A",
    bg: "rgba(255,92,58,0.08)",
    border: "rgba(255,92,58,0.28)",
  },
  {
    href: "/artisans",
    label: "Artisans",
    color: "#FFC93C",
    bg: "rgba(255,201,60,0.08)",
    border: "rgba(255,201,60,0.30)",
  },
  {
    href: "/foraging",
    label: "Foraging",
    color: "#FFB347",
    bg: "rgba(255,179,71,0.08)",
    border: "rgba(255,179,71,0.28)",
  },
  {
    href: "/festdash",
    label: "FestDash",
    color: "#FB923C",
    bg: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.35)",
    bold: true,
  },
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
  useEffect(() => { setOpen(false); }, [pathname]);
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
      <nav className="hidden items-center gap-1.5 text-sm lg:flex">
        {NAV_LINKS.map((l) => {
          const isActive = l.href === "/"
            ? pathname === "/"
            : pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-2.5 py-1 transition ${l.bold ? "font-semibold" : ""}`}
              style={{
                color: isActive ? l.color : l.color + "bb",
                background: isActive ? l.bg.replace(/[\d.]+\)$/, "0.18)") : l.bg,
                border: `1px solid ${isActive ? l.border.replace(/[\d.]+\)$/, "0.55)") : l.border}`,
              }}
            >
              {l.label}
            </Link>
          );
        })}

        <GlobalSearch userId={userId} />

        {userId ? (
          <>
            <MessagesNavLink userId={userId} />
            <NotificationBell userId={userId} />
            <Link href={`/profile/${userId}`} className="px-2 text-neutral-500 transition hover:text-white">
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
              className="rounded-2xl border border-white/15 px-4 py-1.5 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white"
            >
              Sign Out
            </button>
          </>
        ) : (
          /* Signup + Login merged into one pill unit */
          <div className="flex items-center overflow-hidden rounded-full border border-white/15">
            <Link
              href="/signup"
              className="px-4 py-1.5 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-white"
            >
              Signup
            </Link>
            <div className="h-4 w-px bg-white/15" />
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm transition hover:bg-white/5"
              style={{ color: "#00D4FF" }}
            >
              Log In
            </Link>
          </div>
        )}
      </nav>

      {/* ── Mobile right-side icons + hamburger ───────────────── */}
      <div className="flex items-center gap-3 lg:hidden">
        <GlobalSearch userId={userId} />
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

      {/* ── Mobile drawer ─────────────────────────────────────── */}
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[9999] lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-neutral-950 shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="font-bebas text-xl tracking-wide">NorthEDM</p>
                <p className="font-dm-mono text-[9px] uppercase tracking-[0.3em] text-neutral-600">
                  Unite the Northeast
                </p>
                <p className="font-dm-mono text-[9px] uppercase tracking-[0.3em] text-neutral-600">
                  Northeast Dance Music
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
              <div className="px-3">
                {NAV_LINKS.map((l) => {
                  const isActive = l.href === "/"
                    ? pathname === "/"
                    : pathname === l.href || pathname.startsWith(l.href + "/");
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`mt-1 flex items-center rounded-xl px-4 py-3 text-base transition ${l.bold ? "font-semibold" : "font-medium"}`}
                      style={{
                        color: l.color,
                        background: isActive
                          ? l.bg.replace(/[\d.]+\)$/, "0.18)")
                          : l.bg.replace(/[\d.]+\)$/, "0.05)"),
                        borderLeft: `2px solid ${isActive ? l.border.replace(/[\d.]+\)$/, "0.6)") : l.border}`,
                      }}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 border-t border-white/10" />

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
                      className="flex items-center justify-center rounded-xl bg-[#39FF14] px-4 py-3.5 text-base font-semibold text-black transition hover:opacity-90"
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
