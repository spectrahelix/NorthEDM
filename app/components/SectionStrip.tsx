"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV_LINKS } from "./navLinks";

// The site's sections as a swipeable row of bubbles under the header, on
// phones and tablets — the same list and colours as the hamburger menu
// (navLinks.ts), so people can jump around without opening it. Desktop
// already shows these bubbles in the header, so the row is hidden there.
export function SectionStrip() {
  const pathname = usePathname() ?? "/";
  const rowRef = useRef<HTMLDivElement>(null);
  const activeHref = NAV_LINKS.find((l) => pathname === l.href || pathname.startsWith(l.href + "/"))?.href ?? null;

  // Keep the current section's bubble in view.
  useEffect(() => {
    const el = activeHref ? rowRef.current?.querySelector<HTMLElement>(`[data-href="${activeHref}"]`) : null;
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeHref]);

  return (
    <nav aria-label="Sections" className="border-b border-white/5 lg:hidden">
      <div ref={rowRef} className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_LINKS.map((l) => {
          const active = l.href === activeHref;
          return (
            <Link key={l.href} href={l.href} data-href={l.href} aria-current={active ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] transition ${l.bold ? "font-semibold" : "font-medium"}`}
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
