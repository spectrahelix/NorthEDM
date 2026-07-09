// NorthEDM festival flyer — LIGHT variant. US Letter portrait, 8.5x11 @ 300dpi.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const b64 = (p) => `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
const LOGO = b64(path.join(__dirname, "..", "stickers", "logo-circle.png"));
const QR_HOME = b64(path.join(__dirname, "qr-home.png"));
const QR_SIGNUP = b64(path.join(__dirname, "qr-signup.png"));
const QR_FB = b64(path.join(__dirname, "qr-facebook.png"));
const FD_STEPS = b64(path.join(__dirname, "fd-steps.png"));
const FD_ORDERS = b64(path.join(__dirname, "fd-orders.png"));

const W = 850, H = 1100;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px}
  .page{position:relative;width:${W}px;height:${H}px;overflow:hidden;color:#1a1a22;display:flex;flex-direction:column;
    font-family:'DejaVu Sans',sans-serif;
    background:
      radial-gradient(ellipse 60% 34% at 50% 0%, rgba(0,180,220,0.10), transparent 60%),
      radial-gradient(ellipse 50% 34% at 6% 52%, rgba(45,190,60,0.08), transparent 55%),
      radial-gradient(ellipse 55% 38% at 96% 86%, rgba(190,0,220,0.08), transparent 55%),
      linear-gradient(165deg,#ffffff 0%,#f5f6f8 60%,#eef0f3 100%);}
  .mono{font-family:'DejaVu Sans Mono',monospace}
  .up{text-transform:uppercase}
  .grad{background:linear-gradient(90deg,#12933f,#0a7ea3);-webkit-background-clip:text;background-clip:text;color:transparent}
  .spectral{height:3px;background:linear-gradient(90deg,transparent,#22C55E 18%,#06B6D4 50%,#C026D3 82%,transparent)}
  .pad{padding:0 40px}

  .hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 40px 10px}
  .brand{display:flex;align-items:center;gap:13px}
  .brand img{width:60px;height:60px;border-radius:50%}
  .brand .nm{font-size:34px;font-weight:bold;letter-spacing:1px;line-height:1}
  .brand .tl{font-size:10.5px;letter-spacing:5px;color:#15803d;margin-top:2px}
  .hqr{display:flex;flex-direction:column;align-items:center;gap:3px}
  .hqr .t{background:#fff;border:1px solid #d8dce2;border-radius:9px;padding:5px}
  .hqr img{width:56px;height:56px;display:block}
  .hqr .l{font-size:8.5px;letter-spacing:2px;color:#6b6b76}

  .hero{text-align:center;padding:8px 40px 2px}
  .hero .logo{width:88px;height:88px;margin:0 auto;border-radius:50%}
  .head{font-size:42px;font-weight:bold;letter-spacing:1px;line-height:.98;margin-top:2px}
  .sub{font-size:13.5px;letter-spacing:3px;color:#0a7ea3;margin-top:5px}
  .foryou{font-size:13px;line-height:1.35;color:#33333c;max-width:670px;margin:5px auto 0}
  .foryou b{color:#000}

  .st{font-size:12px;letter-spacing:5px;color:#6b6b76;text-align:center;margin:9px 0 6px}
  .st span{color:#12933f}

  .big3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}
  .card{border:1px solid #dfe2e8;border-radius:14px;padding:12px;background:#fbfcfd;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  .card .ic{font-size:23px}
  .card h3{font-size:16.5px;margin-top:4px;color:#111}
  .card p{font-size:12px;line-height:1.36;color:#454652;margin-top:4px}
  .card .price{margin-top:5px;font-size:12px;letter-spacing:1px;color:#B26A00;font-weight:bold}
  .small2{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:10px}
  .tile{border:1px solid #e4e7ec;border-radius:12px;padding:10px 12px;background:#f8f9fb;display:flex;gap:9px;align-items:flex-start}
  .tile .ic{font-size:18px}
  .tile h4{font-size:14px;color:#111}
  .tile p{font-size:11.5px;line-height:1.32;color:#4a4b56;margin-top:2px}

  .fd{margin:8px 40px 0;border:1px solid #f2c79a;border-radius:16px;padding:10px 14px;
    background:radial-gradient(ellipse at 20% 0%, rgba(234,115,23,.12), transparent 60%), #fff7ef}
  .fd .h{display:flex;align-items:baseline;gap:11px}
  .fd .h .t{font-size:27px;font-weight:bold;letter-spacing:1px;color:#1a1a22}
  .fd .h .t .o{color:#EA580C}
  .fd .h .s{font-size:11.5px;letter-spacing:2px;color:#C2410C}
  .fd .body{font-size:12px;line-height:1.35;color:#3a3b45;margin-top:6px}
  .fd .body b{color:#000}
  .fd .vis{display:flex;gap:12px;align-items:center;margin-top:6px}
  .fd .vis .steps{flex:1;border-radius:9px;overflow:hidden;border:1px solid #e0d3c4}
  .fd .vis .steps img{width:100%;display:block}
  .fd .vis .orders img{width:120px;display:block;border-radius:9px;border:1px solid #e0d3c4}

  .found{margin:6px 40px 0;text-align:center;font-size:12px;line-height:1.34;color:#1c3d24;
    border:1px dashed #7bd18c;border-radius:11px;padding:6px 14px;background:#f0fff3}
  .found b{color:#15803d}

  .foot{margin-top:auto;padding:7px 40px 10px;border-top:1px solid #dfe2e8;
    background:linear-gradient(0deg,#f2f4f7,transparent)}
  .foot .row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
  .foot .cta{font-size:18px;font-weight:bold;line-height:1.08}
  .foot .contact{font-size:12.5px;line-height:1.4;color:#2a2b34;margin-top:5px}
  .foot .contact .nm{font-weight:bold;color:#000;font-size:14.5px}
  .foot .llc{margin-top:5px;font-size:10.5px;letter-spacing:2.5px;color:#6b6b76}
  .foot .qrs{display:flex;gap:14px}
  .foot .q{display:flex;flex-direction:column;align-items:center;gap:4px}
  .foot .q .t{background:#fff;border:1px solid #d8dce2;border-radius:10px;padding:6px}
  .foot .q.signup img{width:90px;height:90px;display:block}
  .foot .q.fb img{width:60px;height:60px;display:block}
  .foot .q .l{font-size:9.5px;letter-spacing:1px;color:#4a4b56;text-align:center;max-width:110px}
  .foot .q.signup .l{color:#12933f;font-weight:bold}
</style></head><body>
  <div class="page">
    <div class="hdr">
      <div class="brand">
        <img src="${LOGO}"/>
        <div>
          <div class="grad nm">NorthEDM</div>
          <div class="mono up tl">Unite the Northeast</div>
        </div>
      </div>
      <div class="hqr">
        <div class="t"><img src="${QR_HOME}"/></div>
        <div class="mono up l">See the site</div>
      </div>
    </div>
    <div class="spectral"></div>

    <div class="hero">
      <img class="logo" src="${LOGO}"/>
      <div class="grad head">You Belong Here.</div>
      <div class="mono up sub">A home for makers, vendors &amp; dreamers</div>
      <p class="foryou">
        NorthEDM is more than a website — it's a movement to <b>unite the Northeast</b>. We give
        artisans, vendors &amp; creators a place to be <b>seen</b>, get <b>known</b>, and <b>belong</b>
        among like minds. Set up shop, get advertised, get sponsored, and plug into a network where
        supporting the brand supports <b>you</b> — even earn passive income as the community grows.
        <b>As we rise, you rise.</b>
      </p>
    </div>

    <div class="st">WHAT <span>NorthEDM</span> DOES FOR YOU</div>
    <div class="pad">
      <div class="big3">
        <div class="card">
          <div class="ic">🍄</div>
          <h3>Foraging Tours</h3>
          <p>A 2-hr lesson, hike &amp; forage with Licensed Expert Forager &amp; Founder CJ Lewis. Parties 1–20 — your spot or ours.</p>
          <div class="mono price">$99–$500</div>
        </div>
        <div class="card">
          <div class="ic">💻</div>
          <h3>Affordable Websites</h3>
          <p>Custom sites <b>built, edited &amp; security-audited</b> to fit any budget. Relatable, flexible — bartering always welcome.</p>
        </div>
        <div class="card">
          <div class="ic">📣</div>
          <h3>Advertising Bulletins</h3>
          <p>Get seen. Put your business, events &amp; offerings in front of the whole NorthEDM community.</p>
        </div>
      </div>
      <div class="small2">
        <div class="tile"><div class="ic">🛒</div><div><h4>In-House Marketplace</h4><p>No website? Set up shop <b>right inside</b> NorthEDM.</p></div></div>
        <div class="tile"><div class="ic">✦</div><div><h4>Service Portal</h4><p>A network of artisans, makers &amp; talent — <b>ask for anything.</b></p></div></div>
      </div>
    </div>

    <div class="fd">
      <div class="h"><div class="t">Fest<span class="o">Dash</span></div><div class="mono up s">The Shop Never Stops</div></div>
      <p class="body">
        <b>Any vendor. Any event.</b> Fair, campground, festival — FestDash ends the long-line nightmare
        that caps how many customers you serve and how much you make. <b>Sell more, serve more, set your own hours.</b>
        Customers skip the line: food, goods, rare items, pre-orders — even <b>campsite auto repair</b> — delivered to their spot.
      </p>
      <div class="vis">
        <div class="steps"><img src="${FD_STEPS}"/></div>
        <div class="orders"><img src="${FD_ORDERS}"/></div>
      </div>
    </div>

    <div class="found">
      ⚡ <b>Founding members wanted.</b> A Northeast-PA-born network on the rise — the earliest artisans &amp; vendors
      get the spotlight as we grow. <b>Claim your spot before the crowd.</b>
    </div>

    <div class="foot">
      <div class="row">
        <div>
          <div class="grad cta">Scan to join the community<br/>where you belong!</div>
          <div class="contact">
            <span class="nm">CJ Lewis</span> · Owner &amp; Founder<br/>
            📞 570-951-4219 &nbsp; 🌐 northedm.com<br/>
            ✉ cjblue27@gmail.com &nbsp; northedm1@gmail.com
          </div>
          <div class="mono up llc">NorthEDM LLC — Community. Commerce. Culture.</div>
        </div>
        <div class="qrs">
          <div class="q fb"><div class="t"><img src="${QR_FB}"/></div><div class="mono l">Follow on<br/>Facebook</div></div>
          <div class="q signup"><div class="t"><img src="${QR_SIGNUP}"/></div><div class="mono up l">Sign-up is FREE!</div></div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: "networkidle" });
  try { await p.evaluate(() => document.fonts.ready); } catch {}
  await p.screenshot({ path: path.join(__dirname, "flyer-light.png") });
  await b.close();
  console.log("flyer-light.png rendered");
})();
