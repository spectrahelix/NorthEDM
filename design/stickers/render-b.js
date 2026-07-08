// Sticker B variants: big-logo hero + corner QR, blue url + orange subline (from C),
// "Unite the Northeast" tagline (from A). 3 versions with layout tweaks.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const LOGO = `data:image/png;base64,${b64(path.join(DIR, "..", "northedm-logo.png"))}`;
const QR = `data:image/png;base64,${b64(path.join(DIR, "qr-home.png"))}`;

const S = 750;

const BASE = `
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
  .url { color:#00D4FF; letter-spacing:5px; }         /* blue link (from C) */
  .sub { color:#FB923C; letter-spacing:5px; }          /* orange subline (from C) */
  .tag { color:rgba(57,255,20,0.6); letter-spacing:8px; } /* unite the northeast (from A) */
  .qrtile { background:#fff; border-radius:16px; padding:8px; }
  .scan { color:#9a9aa2; letter-spacing:4px; }
`;
const page = (css, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${css}</style></head><body>${body}</body></html>`;

// V1 — tagline on top, QR top-right, url+sub centered at bottom
const V1 = page(`
  .col{position:absolute;inset:66px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
  .tag{font-size:12px}
  .hero{display:flex;flex-direction:column;align-items:center;margin-top:6px}
  .logo{width:260px;height:260px}
  .name{font-size:50px;letter-spacing:3px;margin-top:2px}
  .url{font-size:24px}
  .sub{font-size:11px;margin-top:4px}
  .qr{position:absolute;top:60px;right:60px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .qrtile img{width:104px;height:104px;display:block}
  .scan{font-size:9px}
`, `
  <div class="sticker"><div class="ring"></div>
    <div class="col">
      <div class="mono up tag">Unite the Northeast</div>
      <div class="hero"><img class="logo" src="${LOGO}"/><div class="word name">NorthEDM</div></div>
      <div><div class="mono up url">northedm.com</div><div class="mono up sub">Community · Marketplace · FestDash</div></div>
    </div>
    <div class="qr"><div class="qrtile"><img src="${QR}"/></div><div class="mono up scan">Scan</div></div>
  </div>
`);

// V2 — tagline under wordmark, url+sub bottom-left, QR bottom-right
const V2 = page(`
  .hero{position:absolute;left:0;right:0;top:96px;display:flex;flex-direction:column;align-items:center;text-align:center}
  .logo{width:300px;height:300px}
  .name{font-size:54px;letter-spacing:4px;margin-top:2px}
  .tag{font-size:12px;margin-top:10px}
  .foot{position:absolute;left:70px;bottom:66px;text-align:left}
  .url{font-size:24px}
  .sub{font-size:10px;margin-top:5px;letter-spacing:3px}
  .qr{position:absolute;right:64px;bottom:60px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .qrtile img{width:118px;height:118px;display:block}
  .scan{font-size:9px}
`, `
  <div class="sticker"><div class="ring"></div>
    <div class="hero">
      <img class="logo" src="${LOGO}"/>
      <div class="word name">NorthEDM</div>
      <div class="mono up tag">Unite the Northeast</div>
    </div>
    <div class="foot">
      <div class="mono up url">northedm.com</div>
      <div class="mono up sub">Community ·<br/>Marketplace ·<br/>FestDash</div>
    </div>
    <div class="qr"><div class="qrtile"><img src="${QR}"/></div><div class="mono up scan">Scan to join</div></div>
  </div>
`);

// V3 — symmetric: tagline top, logo+word, QR centered above url+sub
const V3 = page(`
  .col{position:absolute;inset:60px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
  .tag{font-size:12px}
  .hero{display:flex;flex-direction:column;align-items:center}
  .logo{width:210px;height:210px}
  .name{font-size:44px;letter-spacing:3px;margin-top:2px}
  .qrwrap{display:flex;flex-direction:column;align-items:center;gap:8px}
  .qrtile img{width:150px;height:150px;display:block}
  .scan{font-size:10px}
  .url{font-size:22px}
  .sub{font-size:10px;margin-top:4px}
`, `
  <div class="sticker"><div class="ring"></div>
    <div class="col">
      <div class="mono up tag">Unite the Northeast</div>
      <div class="hero"><img class="logo" src="${LOGO}"/><div class="word name">NorthEDM</div></div>
      <div class="qrwrap"><div class="qrtile"><img src="${QR}"/></div><div class="mono up scan">Scan to join the community</div></div>
      <div><div class="mono up url">northedm.com</div><div class="mono up sub">Community · Marketplace · FestDash</div></div>
    </div>
  </div>
`);

const OUT = [["sticker-B1", V1], ["sticker-B2", V2], ["sticker-B3", V3]];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const [n, h] of OUT) {
    await p.setContent(h, { waitUntil: "networkidle" });
    try { await p.evaluate(() => document.fonts.ready); } catch {}
    await p.screenshot({ path: path.join(DIR, `${n}.png`) });
    console.log(n);
  }
  await b.close();
  console.log("done");
})();
