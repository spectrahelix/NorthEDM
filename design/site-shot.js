const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const resp = await page.goto("http://localhost:3210/", { waitUntil: "networkidle", timeout: 60000 });
  console.log("status", resp.status());
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "design/site-header.png", clip: { x: 0, y: 0, width: 1280, height: 220 } });
  const f = await page.$("footer");
  if (f) await f.screenshot({ path: "design/site-footer.png" });
  await browser.close();
  console.log("shots done");
})();
