const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const svg = fs.readFileSync("design/northedm-logo.svg", "utf8");
  const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a">${svg}</body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle" });
  const el = await page.$("svg");
  await el.screenshot({ path: "design/northedm-logo.png" });
  await browser.close();
  console.log("rendered design/northedm-logo.png");
})();
