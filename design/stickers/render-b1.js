// Final sticker: B1, sized up. Big centered logo, bigger text, small corner QR.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const LOGO = `data:image/png;base64,${b64(path.join(DIR, "..", "northedm-logo.png"))}`;
const QR = `data:image/png;base64,${b64(path.join(DIR, "qr-home.png"))}`;

const S = 750;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${S}px; height:${S}px; }
  .sticker { position:relative; width:${S}px; height:${S}px; overflow:hidden;
    font-family:'DejaVu Sans', sans-serif; color:#f2f2f4;
    background:
      radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,212,255,0.10), transparent 60%),
      radial-gradient(ellipse 60% 60% at 12% 100%, rgba(57,255,20,0.09), transparent 55%),
      radial-gradient(ellipse 60% 60% at 88% 100%, rgba(204,0,255,0.10), transparent 55%),
      linear-gradient(160deg,#08070b 0%,#050506 55%,#020203 100%); }
  .mono { font-family:'DejaVu Sans Mono', monospace; }
  .up { text-transform:uppercase; }
  .word { font-weight:bold; letter-spacing:1px;
    background:linear-gradient(90deg,#39FF14,#00D4FF);
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  .ring { position:absolute; inset:37px; border-radius:44px; padding:2px;
    background:linear-gradient(135deg,#39FF14,#00D4FF,#CC00FF);
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite:xor; mask-composite:exclude; opacity:0.85; }

  /* Centered logo group */
  .center { position:absolute; left:0; right:0; top:50%; transform:translateY(-52%);
    display:flex; flex-direction:column; align-items:center; text-align:center; }
  .tag { color:rgba(57,255,20,0.62); letter-spacing:9px; font-size:16px; margin-bottom:8px; }
  .logo { width:360px; height:360px; }
  .name { font-size:70px; letter-spacing:4px; margin-top:2px; }

  /* Bottom block */
  .foot { position:absolute; left:0; right:0; bottom:64px; text-align:center; }
  .url { color:#00D4FF; letter-spacing:6px; font-size:32px; }
  .sub { color:#FB923C; letter-spacing:5px; font-size:15px; margin-top:7px; }

  /* Corner QR */
  .qr { position:absolute; top:58px; right:58px; display:flex; flex-direction:column; align-items:center; gap:6px; }
  .qrtile { background:#fff; border-radius:16px; padding:8px; }
  .qrtile img { width:104px; height:104px; display:block; }
  .scan { color:#9a9aa2; letter-spacing:4px; font-size:10px; }
</style></head><body>
  <div class="sticker">
    <div class="ring"></div>
    <div class="center">
      <div class="mono up tag">Unite the Northeast</div>
      <img class="logo" src="${LOGO}"/>
      <div class="word name">NorthEDM</div>
    </div>
    <div class="foot">
      <div class="mono up url">northedm.com</div>
      <div class="mono up sub">Community · Marketplace · FestDash</div>
    </div>
    <div class="qr">
      <div class="qrtile"><img src="${QR}"/></div>
      <div class="mono up scan">Scan</div>
    </div>
  </div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: "networkidle" });
  try { await p.evaluate(() => document.fonts.ready); } catch {}
  await p.screenshot({ path: path.join(DIR, "sticker-final.png") });
  await b.close();
  console.log("sticker-final.png");
})();
