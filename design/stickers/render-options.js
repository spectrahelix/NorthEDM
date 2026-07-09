// Two looks: (1) the square sticker with the logo's black box removed so it
// blends into the dark background; (2) a round die-cut sticker (circle-only logo).
const { chromium } = require("playwright");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const LOGO_SRC = path.join(DIR, "..", "northedm-logo.png");
const QR = `data:image/png;base64,${fs.readFileSync(path.join(DIR, "qr-home.png")).toString("base64")}`;
const S = 750;

(async () => {
  // 1) Circular cutout of the logo — mask everything outside the flower circle to transparent.
  const meta = await sharp(LOGO_SRC).metadata(); // 1200x1200
  const d = meta.width; // 1200
  const r = Math.round(d * 0.485); // radius that hugs the outer green ring
  const mask = Buffer.from(
    `<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="#fff"/></svg>`
  );
  const circleBuf = await sharp(LOGO_SRC)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  await sharp(circleBuf).toFile(path.join(DIR, "logo-circle.png"));
  const LOGO_C = `data:image/png;base64,${circleBuf.toString("base64")}`;

  const BG = `
    background:
      radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,212,255,0.10), transparent 60%),
      radial-gradient(ellipse 60% 60% at 12% 100%, rgba(57,255,20,0.09), transparent 55%),
      radial-gradient(ellipse 60% 60% at 88% 100%, rgba(204,0,255,0.10), transparent 55%),
      linear-gradient(160deg,#08070b 0%,#050506 55%,#020203 100%);`;
  const FONTS = `
    .mono{font-family:'DejaVu Sans Mono',monospace}.up{text-transform:uppercase}
    .word{font-weight:bold;letter-spacing:1px;background:linear-gradient(90deg,#39FF14,#00D4FF);-webkit-background-clip:text;background-clip:text;color:transparent}`;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();

  // --- Look 1: blended square (logo box removed) ---
  const blended = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}html,body{width:${S}px;height:${S}px}
    .sticker{position:relative;width:${S}px;height:${S}px;overflow:hidden;font-family:'DejaVu Sans',sans-serif;color:#f2f2f4;${BG}}
    ${FONTS}
    .ring{position:absolute;inset:37px;border-radius:44px;padding:2px;background:linear-gradient(135deg,#39FF14,#00D4FF,#CC00FF);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.85}
    .center{position:absolute;left:0;right:0;top:50%;transform:translateY(-54%);display:flex;flex-direction:column;align-items:center;text-align:center}
    .url{color:#00D4FF;letter-spacing:5px;font-size:30px;margin-bottom:12px}
    .logo{width:338px;height:338px}
    .name{font-size:64px;letter-spacing:4px;margin-top:-2px}
    .foot{position:absolute;left:0;right:0;bottom:46px;text-align:center}
    .tag{color:rgba(57,255,20,.7);letter-spacing:3px;font-size:31px}
    .sub{color:#FB923C;letter-spacing:1px;font-size:25px;margin-top:11px}
    .qr{position:absolute;top:58px;right:58px;display:flex;flex-direction:column;align-items:center;gap:6px}
    .qrtile{background:#fff;border-radius:16px;padding:8px}.qrtile img{width:104px;height:104px;display:block}
    .scan{color:#9a9aa2;letter-spacing:4px;font-size:10px}
  </style></head><body>
    <div class="sticker"><div class="ring"></div>
      <div class="center"><div class="mono up url">northedm.com</div><img class="logo" src="${LOGO_C}"/><div class="word name">NorthEDM</div></div>
      <div class="foot"><div class="mono up tag">Unite the Northeast</div><div class="mono up sub">Community · Marketplace · FestDash</div></div>
      <div class="qr"><div class="qrtile"><img src="${QR}"/></div><div class="mono up scan">Scan</div></div>
    </div>
  </body></html>`;
  await p.setContent(blended, { waitUntil: "networkidle" });
  try { await p.evaluate(() => document.fonts.ready); } catch {}
  await p.screenshot({ path: path.join(DIR, "sticker-blended.png") });

  // --- Look 2: round die-cut (circle-only logo) ---
  const round = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}html,body{width:${S}px;height:${S}px;background:transparent}
    ${FONTS}
    .round{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:712px;height:712px;border-radius:50%;overflow:hidden;font-family:'DejaVu Sans',sans-serif;color:#f2f2f4;${BG}}
    .cring{position:absolute;inset:0;border-radius:50%;padding:5px;background:linear-gradient(135deg,#39FF14,#00D4FF,#CC00FF);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
    .stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
    .tag{color:rgba(57,255,20,.62);letter-spacing:8px;font-size:15px;margin-bottom:2px}
    .logo{width:430px;height:430px}
    .name{font-size:52px;letter-spacing:3px;margin-top:-14px}
    .url{color:#00D4FF;letter-spacing:5px;font-size:20px;margin-top:6px}
  </style></head><body>
    <div class="round"><div class="cring"></div>
      <div class="stack"><div class="mono up tag">Unite the Northeast</div><img class="logo" src="${LOGO_C}"/><div class="word name">NorthEDM</div><div class="mono up url">northedm.com</div></div>
    </div>
  </body></html>`;
  await p.setContent(round, { waitUntil: "networkidle" });
  try { await p.evaluate(() => document.fonts.ready); } catch {}
  await p.screenshot({ path: path.join(DIR, "sticker-diecut.png"), omitBackground: true });

  // Preview of the die-cut on a neutral surface so the round cut is obvious.
  const dc = await sharp(path.join(DIR, "sticker-diecut.png")).toBuffer();
  await sharp({ create: { width: S * 2, height: S * 2, channels: 4, background: { r: 210, g: 212, b: 216, alpha: 1 } } })
    .composite([{ input: dc }])
    .png()
    .toFile(path.join(DIR, "sticker-diecut-preview.png"));

  await browser.close();
  console.log("blended + diecut done");
})();
