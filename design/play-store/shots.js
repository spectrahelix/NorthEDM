// Capture phone screenshots of the live NorthEDM site for the Play Store listing.
// Play requires 2–8 phone screenshots, PNG/JPG, 16:9 or 9:16, each side 320–3840px.
// We shoot at 1080x1920 (9:16) which Play accepts directly.
const { chromium } = require("playwright");

const BASE = "https://www.northedm.com";
const OUT = __dirname;

// Pages worth showing in the store. label drives the output filename.
const PAGES = [
  { path: "/", label: "01-home" },
  { path: "/marketplace", label: "02-marketplace" },
  { path: "/shop", label: "03-shop" },
  { path: "/festdash", label: "04-festdash" },
  { path: "/forum", label: "05-forum" },
  { path: "/foraging", label: "06-foraging" },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  });
  const page = await ctx.newPage();

  for (const { path, label } of PAGES) {
    try {
      const r = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
      try { await page.evaluate(() => document.fonts.ready); } catch {}
      await page.waitForTimeout(2000);
      // viewport-only shot = exactly 1080x1920 (9:16)
      await page.screenshot({ path: `${OUT}/${label}.png` });
      console.log(label, r.status());
    } catch (e) {
      console.log(label, "ERR", e.message);
    }
  }

  await browser.close();
  console.log("screenshots done");
})();
