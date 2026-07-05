// Render NorthEDM business cards (3.5x2in @ 300dpi = 1050x600) via headless Chromium.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const LOGO = `data:image/png;base64,${b64(path.join(DIR, "..", "northedm-logo.png"))}`;
const QR = `data:image/png;base64,${b64(path.join(DIR, "qr-signup.png"))}`;

const W = 1050, H = 600;

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${W}px; height:${H}px; }
  .card {
    position:relative; width:${W}px; height:${H}px; overflow:hidden;
    font-family:'DejaVu Sans', sans-serif; color:#f2f2f4;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,255,0.07), transparent 60%),
      radial-gradient(ellipse 60% 60% at 10% 100%, rgba(57,255,20,0.06), transparent 55%),
      radial-gradient(ellipse 60% 60% at 90% 100%, rgba(204,0,255,0.07), transparent 55%),
      linear-gradient(160deg,#08070b 0%,#050506 55%,#020203 100%);
  }
  .spectral { position:absolute; left:0; right:0; height:4px;
    background:linear-gradient(90deg,transparent 0%,#39FF14 18%,#00D4FF 50%,#CC00FF 82%,transparent 100%); }
  .mono { font-family:'DejaVu Sans Mono', monospace; }
  .word {
    font-family:'DejaVu Sans', sans-serif; font-weight:bold; letter-spacing:2px;
    background:linear-gradient(90deg,#39FF14,#00D4FF);
    -webkit-background-clip:text; background-clip:text; color:transparent;
  }
  .up { text-transform:uppercase; }
`;

function page(css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

// ---- Design A — FRONT: centered logo hero ----
const A_FRONT = page(`
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .logo{width:230px;height:230px}
  .name{font-size:64px;letter-spacing:6px;margin-top:6px}
  .tag{font-size:16px;letter-spacing:10px;color:rgba(57,255,20,0.55);margin-top:12px}
  .sub{font-size:12px;letter-spacing:7px;color:#6d6d76;margin-top:8px}
  .fd{position:absolute;bottom:44px;font-size:12px;letter-spacing:6px;color:#FB923C}
`, `
  <div class="card">
    <div class="spectral" style="top:0"></div>
    <div class="wrap">
      <img class="logo" src="${LOGO}"/>
      <div class="word name">NorthEDM</div>
      <div class="mono up tag">Unite the Northeast</div>
      <div class="mono up sub">Northeast Dance Music</div>
      <div class="mono up fd">FestDash&trade; &middot; Festival Delivery Network</div>
    </div>
    <div class="spectral" style="bottom:0"></div>
  </div>
`);

// ---- Design A — BACK: contact + QR ----
const CONTACT = `
  <div class="row"><span class="ic">◈</span><span class="big">CJ Lewis</span><span class="role mono up">Founder</span></div>
  <div class="line mono"><span class="lbl">TEL</span> 570·951·4219</div>
  <div class="line mono"><span class="lbl">EML</span> northedm1@gmail.com</div>
  <div class="line mono"><span class="lbl">EML</span> cj@northedm.com</div>
  <div class="line mono"><span class="lbl">WEB</span> www.northedm.com</div>
`;
const A_BACK = page(`
  .pad{position:absolute;inset:0;padding:56px 60px;display:flex;justify-content:space-between}
  .left{display:flex;flex-direction:column;justify-content:center;max-width:560px}
  .row{display:flex;align-items:baseline;gap:14px;margin-bottom:22px}
  .ic{color:#FFC93C;font-size:26px}
  .big{font-size:44px;font-weight:bold;letter-spacing:1px}
  .role{font-size:12px;letter-spacing:4px;color:#39FF14}
  .line{font-size:19px;letter-spacing:1px;color:#d6d6da;margin:9px 0}
  .lbl{display:inline-block;width:52px;color:#00D4FF;font-size:13px;letter-spacing:2px}
  .fd{margin-top:22px;font-size:12px;letter-spacing:5px;color:#FB923C}
  .right{display:flex;flex-direction:column;align-items:center;justify-content:center}
  .qrtile{background:#fff;border-radius:22px;padding:16px}
  .qrtile img{width:190px;height:190px;display:block}
  .scan{margin-top:14px;font-size:12px;letter-spacing:5px;color:#9a9aa2;text-align:center}
`, `
  <div class="card">
    <div class="spectral" style="top:0"></div>
    <div class="pad">
      <div class="left">
        ${CONTACT}
        <div class="mono up fd">FestDash&trade; &middot; Festival Delivery Network</div>
      </div>
      <div class="right">
        <div class="qrtile"><img src="${QR}"/></div>
        <div class="mono up scan">Scan to<br/>join NorthEDM</div>
      </div>
    </div>
    <div class="spectral" style="bottom:0"></div>
  </div>
`);

// ---- Design B — FRONT: left gradient panel split ----
const B_FRONT = page(`
  .panel{position:absolute;left:0;top:0;bottom:0;width:400px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 45%,rgba(0,212,255,0.16),transparent 62%);border-right:1px solid rgba(255,255,255,0.06)}
  .panel img{width:250px;height:250px}
  .r{position:absolute;left:400px;right:0;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding:0 56px}
  .name{font-size:60px;letter-spacing:5px}
  .tag{font-size:14px;letter-spacing:8px;color:rgba(57,255,20,0.55);margin-top:14px}
  .who{font-size:24px;font-weight:bold;margin-top:34px;letter-spacing:1px}
  .role{font-size:12px;letter-spacing:5px;color:#39FF14;margin-top:4px}
  .fd{font-size:11px;letter-spacing:5px;color:#FB923C;margin-top:26px}
`, `
  <div class="card">
    <div class="spectral" style="top:0"></div>
    <div class="panel"><img src="${LOGO}"/></div>
    <div class="r">
      <div class="word name">NorthEDM</div>
      <div class="mono up tag">Unite the Northeast</div>
      <div class="who">CJ Lewis</div>
      <div class="mono up role">Founder</div>
      <div class="mono up fd">FestDash&trade; &middot; Festival Delivery Network</div>
    </div>
    <div class="spectral" style="bottom:0"></div>
  </div>
`);

// ---- Design C — FRONT: minimal bold wordmark ----
const C_FRONT = page(`
  .wrap{position:absolute;inset:0;padding:64px;display:flex;flex-direction:column;justify-content:space-between}
  .top{display:flex;align-items:center;gap:22px}
  .top img{width:96px;height:96px}
  .name{font-size:56px;letter-spacing:4px}
  .mid{font-size:14px;letter-spacing:9px;color:rgba(0,212,255,0.6)}
  .bottom{display:flex;justify-content:space-between;align-items:flex-end}
  .who{font-size:26px;font-weight:bold}
  .role{font-size:12px;letter-spacing:5px;color:#39FF14;margin-top:4px}
  .fd{font-size:11px;letter-spacing:5px;color:#FB923C;text-align:right}
`, `
  <div class="card">
    <div class="spectral" style="top:0"></div>
    <div class="wrap">
      <div class="top"><img src="${LOGO}"/><div class="word name">NorthEDM</div></div>
      <div class="mono up mid">Unite the Northeast · Northeast Dance Music</div>
      <div class="bottom">
        <div><div class="who">CJ Lewis</div><div class="mono up role">Founder</div></div>
        <div class="mono up fd">FestDash&trade;<br/>Festival Delivery</div>
      </div>
    </div>
    <div class="spectral" style="bottom:0"></div>
  </div>
`);

const CARDS = [
  ["card-A-front", A_FRONT],
  ["card-A-back", A_BACK],
  ["card-B-front", B_FRONT],
  ["card-C-front", C_FRONT],
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (const [name, html] of CARDS) {
    await p.setContent(html, { waitUntil: "networkidle" });
    try { await p.evaluate(() => document.fonts.ready); } catch {}
    await p.screenshot({ path: path.join(DIR, `${name}.png`) });
    console.log(name);
  }
  await browser.close();
  console.log("cards done");
})();
