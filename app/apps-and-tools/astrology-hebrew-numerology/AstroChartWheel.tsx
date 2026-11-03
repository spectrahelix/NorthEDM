// Screen copy of the chart wheel. The drawing itself is utils/numerology/wheelSvg.ts,
// shared with the PDF so the two can't differ. Its content is numbers and
// fixed glyphs only (labels are escaped there).

import { wheelSvg } from "@/utils/numerology/wheelSvg";
import type { AstrologyResult } from "@/utils/numerology/astrology";

export function AstroChartWheel({ astro }: { astro: Extract<AstrologyResult, { status: "available" }> }) {
  return <div dangerouslySetInnerHTML={{ __html: wheelSvg(astro) }} />;
}
