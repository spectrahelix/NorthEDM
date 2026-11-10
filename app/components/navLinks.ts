// The site's main sections — one list, used by the header nav, the mobile
// drawer, the wrapped section bubbles under the header on phones/tablets
// (SectionStrip, in the layout) and the home page's section buttons. Add a
// section here, not in a page.
export type NavLink = {
  href: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  bold?: boolean;
};

export const NAV_LINKS: NavLink[] = [
  {
    href: "/",
    label: "Home",
    color: "#E5E7EB",
    bg: "rgba(229,231,235,0.08)",
    border: "rgba(229,231,235,0.28)",
  },
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
    href: "/events",
    label: "Events",
    color: "#7DD3FC",
    bg: "rgba(125,211,252,0.08)",
    border: "rgba(125,211,252,0.28)",
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
    href: "/apps-and-tools",
    label: "Apps and Tools",
    color: "#C4B5FD",
    bg: "rgba(196,181,253,0.08)",
    border: "rgba(196,181,253,0.28)",
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
