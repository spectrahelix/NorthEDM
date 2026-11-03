// The Apps and Tools directory. Add a tool here and it appears on
// /apps-and-tools; the menu links to the directory, not to each tool.
export type AppTool = {
  id: string;
  title: string;
  href: string;
  description: string;
  category: string;
};

export const APP_TOOLS: AppTool[] = [
  {
    id: "astrology-hebrew-numerology",
    title: "Astrology and Hebrew Numerology Calculator",
    href: "/apps-and-tools/astrology-hebrew-numerology",
    description:
      "Explore birth charts, Hebrew birthdays, name meanings, and gematria. Create a PDF to keep or share.",
    category: "Astrology and Numerology",
  },
];
