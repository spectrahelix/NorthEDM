import type { Metadata } from "next";
import Link from "next/link";
import { Noto_Sans_Hebrew } from "next/font/google";
import { AstroHebrewCalculator } from "./AstroHebrewCalculator";

// Hebrew font (SIL Open Font License), self-hosted by next/font so the PDF
// embeds the same letters the screen shows.
const hebrewFont = Noto_Sans_Hebrew({ subsets: ["hebrew"], weight: ["400", "700"], display: "swap", variable: "--font-hebrew" });

export const metadata: Metadata = {
  title: "Astrology and Hebrew Numerology Calculator | NorthEDM",
  description: "Explore birth charts, Hebrew birthdays, name meanings, and gematria. Create a PDF to keep or share.",
};

// Printing = the PDF. Only the visible result prints, on white, with table
// headers repeated on each page.
const PRINT_CSS = `
.font-hebrew { font-family: var(--font-hebrew), "Noto Sans Hebrew", "Arial Hebrew", "David", sans-serif; unicode-bidi: isolate; }
@media print {
  @page { size: Letter; margin: 0.6in; }
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  #ne-tool [hidden] { display: none !important; }
  #ne-report, #ne-report *, #ne-words-result, #ne-words-result *, #ne-number-result, #ne-number-result * { visibility: visible; }
  #ne-tool { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; color: #1f2d3a; }
  #ne-tool .print\\:hidden { display: none !important; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  a { color: #1f7a6d !important; }
}
`;

export default function AstrologyHebrewNumerologyPage() {
  return (
    <main id="ne-tool" className={`${hebrewFont.variable} min-h-screen px-4 py-10 text-neutral-100 sm:px-6 sm:py-14`}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="mx-auto max-w-5xl">
        <div className="print:hidden">
          <Link href="/apps-and-tools" className="text-sm text-violet-300 hover:text-violet-200">← Apps and Tools</Link>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">Astrology and Hebrew Numerology Calculator</h1>
          <p className="mt-4 max-w-3xl leading-7 text-neutral-300">
            Hebrew birthday (sunset-aware), Hebrew name spellings and their gematria, matching Hebrew words, traditional
            associations with sources, and a Western birth chart from a real ephemeris. Free, and nothing you enter is saved.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-neutral-500">
            Astrology and numerology are interpretive traditions for reflection, not scientifically validated predictions.
          </p>
        </div>
        <div className="mt-8">
          <AstroHebrewCalculator />
        </div>
      </div>
    </main>
  );
}
