import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mushroom Foraging Tours",
  description:
    "Book a guided mushroom foraging experience with NorthEDM — Appalachian woodland walks, culinary fungi education, and immersive nature outings in the Northeast.",
  openGraph: {
    title: "NorthEDM Mushroom Foraging Tours",
    description:
      "Guided mushroom walks, culinary fungi education, and immersive Appalachian woodland outings.",
    url: "https://northedm.com/foraging",
  },
};

export default function ForagingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
