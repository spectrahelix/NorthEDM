"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

// The site's sections as a compact block of bubbles under the header, on
// phones and tablets — the same list and colours as the hamburger menu
// (navLinks.ts), all visible at once (wrapped to fit the width, no sideways
// scrolling), so people can jump around without opening the menu. Desktop
// already shows these bubbles in the header, so the block is hidden there.
export function SectionStrip() {
  const pathname = usePathname() ?? "/";
  const activeHref = NAV_LINKS.find((l) => pathname === l.href || pathname.startsWith(l.href + "/"))?.href ?? null;
  return (
    <nav aria-label="Sections" className="border-b border-white/5 lg:hidden">
      <div className="flex flex-wrap justify-center gap-1.5 px-3 py-2">
        {NAV_LINKS.map((l) => {
          const active = l.href === activeHref;
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] leading-5 transition ${l.bold ? "font-semibold" : "font-medium"}`}
              style={{
                color: active ? l.color : l.color + "cc",
                background: active ? l.bg.replace(/[\d.]+\)$/, "0.20)") : l.bg,
                border: `1px solid ${active ? l.border.replace(/[\d.]+\)$/, "0.6)") : l.border}`,
              }}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
