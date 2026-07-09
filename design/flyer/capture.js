const { chromium } = require("playwright");
const path = require("path");
const DIR = __dirname;
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const b = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await b.newContext({ ignoreHTTPSErrors: true });
  try {
    const d = await ctx.newPage();
    await d.setViewportSize({ width: 1440, height: 1200 });
    const r = await d.goto("https://www.northedm.com/festdash", { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("festdash desktop", r.status(), await d.title());
    try { await d.evaluate(() => document.fonts.ready); } catch {}
    await d.waitForTimeout(3000);
    await d.screenshot({ path: path.join(DIR, "festdash-desktop-full.png"), fullPage: true });

    const m = await ctx.newPage();
    await m.setViewportSize({ width: 430, height: 1700 });
    await m.goto("https://www.northedm.com/festdash", { waitUntil: "domcontentloaded", timeout: 60000 });
    try { await m.evaluate(() => document.fonts.ready); } catch {}
    await m.waitForTimeout(3000);
    await m.screenshot({ path: path.join(DIR, "festdash-mobile-full.png"), fullPage: true });
    console.log("done");
  } catch (e) {
    console.log("ERR", e.message);
  }
  await b.close();
})();
