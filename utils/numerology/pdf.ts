// Server-side PDF: headless Chromium renders reportHtml.ts. On Vercel (Linux)
// the browser comes from @sparticuz/chromium 153; playwright-core 1.63.0 is the
// Playwright release built for Chromium 153 — upgrade the two together.
// PDF_CHROMIUM_PATH overrides the browser (e.g. a local Playwright Chromium).

import { chromium as playwright, type Browser } from "playwright-core";

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const override = process.env.PDF_CHROMIUM_PATH;
  if (override) return playwright.launch({ executablePath: override, args: ["--no-sandbox"] });
  const sparticuz = (await import("@sparticuz/chromium")).default;
  return playwright.launch({
    executablePath: await sparticuz.executablePath(),
    args: sparticuz.args,
    headless: true,
  });
}

/** Reuse one browser per warm function instance; relaunch if it died. */
async function browser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  browserPromise = launch();
  return browserPromise;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const b = await browser();
  const page = await b.newPage();
  try {
    // No network: everything (fonts included) is inline. Block any request so
    // a stray URL in the content can't make the server fetch anything.
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:7px;color:#5b6b78;width:100%;padding:0 0.6in;display:flex;justify-content:space-between;font-family:sans-serif"><span>NorthEDM • Hebrew Birth &amp; Name Chart • for reflection, not prediction</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: "0.6in", bottom: "0.75in", left: "0.6in", right: "0.6in" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
