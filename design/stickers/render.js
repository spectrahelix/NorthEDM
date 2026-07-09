// Render NorthEDM stickers. Trim 2.25x2.25in @300dpi = 675px; +0.125" bleed => 750px.
// Rendered at 2x for crisp print. Keep key content inside the ~90% safe area.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const LOGO = `data:image/png;base64,${b64(path.join(DIR, "..", "northedm-logo.png"))}`;
const QR = `data:image/png;base64,${b64(path.join(DIR, "qr-home.png"))}`;

const S = 750; // full size incl. bleed

const BASE = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${S}px; height:${S}px; }
  .sticker {
    position:relative; width:${S}px; height:${S}px; overflow:hidden;
    font-family:'DejaVu Sans', sans-serif; color:#f2f2f4;
    background:
      radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,212,255,0.10), transparent 60%),
      radial-gradient(ellipse 60% 60% at 12% 100%, rgba(57,255,20,0.09), transparent 55%),
      radial-gradient(ellipse 60% 60% at 88% 100%, rgba(204,0,255,0.10), transparent 55%),
      linear-gradient(160deg,#08070b 0%,#050506 55%,#020203 100%);
  }
  .mono { font-family:'DejaVu Sans Mono', monospace; }
  .up { text-transform:uppercase; }
  .word { font-weight:bold; letter-spacing:1px;
    background:linear-gradient(90deg,#39FF14,#00D4FF);
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  /* rounded sticker edge hint (safe within bleed) */
  .frame { position:absolute; inset:37px; border-radius:44px;
    border:2px solid rgba(255,255,255,0.10); }
  .spectral-ring { position:absolute; inset:37px; border-radius:44px; padding:2px;
    background:linear-gradient(135deg,#39FF14,#00D4FF,#CC00FF);
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite:xor; mask-composite:exclude; opacity:0.85; }
`;

function page(css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;
}

// ---- Sticker A: logo top, QR center tile, url bottom ----
const A = page(`
  .wrap{position:absolute;inset:70px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
  .logo{width:150px;height:150px}
  .name{font-size:40px;letter-spacing:3px;margin-top:2px}
  .qrtile{background:#fff;border-radius:20px;padding:12px}
  .qrtile img{width:180px;height:180px;display:block}
  .url{font-size:24px;letter-spacing:4px;color:#39FF14}
  .tag{font-size:11px;letter-spacing:6px;color:#7a7a82;margin-top:2px}
`, `
  <div class="sticker">
    <div class="spectral-ring"></div>
    <div class="wrap">
      <div style="display:flex;flex-direction:column;align-items:center">
        <img class="logo" src="${LOGO}"/>
        <div class="word name">NorthEDM</div>
      </div>
      <div class="qrtile"><img src="${QR}"/></div>
      <div>
        <div class="mono up url">northedm.com</div>
        <div class="mono up tag">Unite the Northeast</div>
      </div>
    </div>
  </div>
`);

// ---- Sticker B: big logo hero, QR small bottom-right, "scan" ----
const B = page(`
  .wrap{position:absolute;inset:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .logo{width:300px;height:300px}
  .name{font-size:52px;letter-spacing:4px;margin-top:6px}
  .tag{font-size:12px;letter-spacing:8px;color:rgba(57,255,20,0.6);margin-top:8px}
  .qrtile{position:absolute;right:60px;bottom:60px;background:#fff;border-radius:16px;padding:8px}
  .qrtile img{width:120px;height:120px;display:block}
  .scan{position:absolute;left:70px;bottom:96px;font-size:12px;letter-spacing:4px;color:#9a9aa2;text-align:left;max-width:180px}
`, `
  <div class="sticker">
    <div class="spectral-ring"></div>
    <div class="wrap">
      <img class="logo" src="${LOGO}"/>
      <div class="word name">NorthEDM</div>
      <div class="mono up tag">northedm.com</div>
    </div>
    <div class="mono up scan">Scan to<br/>join the<br/>community</div>
    <div class="qrtile"><img src="${QR}"/></div>
  </div>
`);

// ---- Sticker C: QR is the hero, logo badge + url framing ----
const C = page(`
  .wrap{position:absolute;inset:64px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
  .top{display:flex;align-items:center;gap:12px}
  .top img{width:64px;height:64px}
  .name{font-size:34px;letter-spacing:2px}
  .qrtile{background:#fff;border-radius:22px;padding:14px}
  .qrtile img{width:250px;height:250px;display:block}
  .url{font-size:22px;letter-spacing:5px;color:#00D4FF}
  .sub{font-size:10px;letter-spacing:6px;color:#FB923C;margin-top:4px}
`, `
  <div class="sticker">
    <div class="spectral-ring"></div>
    <div class="wrap">
      <div class="top"><img src="${LOGO}"/><div class="word name">NorthEDM</div></div>
      <div class="qrtile"><img src="${QR}"/></div>
      <div>
        <div class="mono up url">northedm.com</div>
        <div class="mono up sub">Community · Marketplace · FestDash</div>
      </div>
    </div>
  </div>
`);

const OUT = [["sticker-A", A], ["sticker-B", B], ["sticker-C", C]];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const [name, html] of OUT) {
    await p.setContent(html, { waitUntil: "networkidle" });
    try { await p.evaluate(() => document.fonts.ready); } catch {}
    await p.screenshot({ path: path.join(DIR, `${name}.png`) });
    console.log(name);
  }
  await browser.close();
  console.log("stickers done");
})();
