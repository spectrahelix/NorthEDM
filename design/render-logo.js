const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const svg = fs.readFileSync("design/northedm-logo.svg", "utf8");
  const html = `<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
  </head><body style="margin:0;background:#0a0a0a">${svg}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 3 });
  await page.setContent(html, { waitUntil: "networkidle" });
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await page.waitForTimeout(800);
  const el = await page.$("svg");
  await el.screenshot({ path: "design/northedm-logo.png" });
  await browser.close();
  console.log("rendered design/northedm-logo.png");
})();
