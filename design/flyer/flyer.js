// NorthEDM festival flyer — US Letter portrait, 8.5x11 @ 300dpi (2550x3300).
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
  .page{position:relative;width:${W}px;height:${H}px;overflow:hidden;color:#eef;display:flex;flex-direction:column;
    font-family:'DejaVu Sans',sans-serif;
    background:
      radial-gradient(ellipse 60% 36% at 50% 0%, rgba(0,212,255,0.10), transparent 60%),
      radial-gradient(ellipse 50% 36% at 8% 50%, rgba(57,255,20,0.06), transparent 55%),
      radial-gradient(ellipse 55% 40% at 95% 85%, rgba(204,0,255,0.10), transparent 55%),
      linear-gradient(165deg,#08070b 0%,#050506 55%,#020203 100%);}
  .mono{font-family:'DejaVu Sans Mono',monospace}
  .up{text-transform:uppercase}
  .grad{background:linear-gradient(90deg,#39FF14,#00D4FF);-webkit-background-clip:text;background-clip:text;color:transparent}
  .spectral{height:3px;background:linear-gradient(90deg,transparent,#39FF14 18%,#00D4FF 50%,#CC00FF 82%,transparent)}
  .pad{padding:0 40px}

  .hdr{display:flex;align-items:center;justify-content:space-between;padding:11px 40px 7px}
  .brand{display:flex;align-items:center;gap:13px}
  .brand img{width:60px;height:60px}
  .brand .nm{font-size:27px;font-weight:bold;letter-spacing:1px;line-height:1}
  .brand .tl{font-size:9px;letter-spacing:5px;color:rgba(57,255,20,.6);margin-top:2px}
  .hqr{display:flex;flex-direction:column;align-items:center;gap:3px}
  .hqr .t{background:#fff;border-radius:9px;padding:5px}
  .hqr img{width:56px;height:56px;display:block}
  .hqr .l{font-size:8.5px;letter-spacing:2px;color:#9aa}

  .hero{text-align:center;padding:3px 40px 2px}
  .hero .logo{width:132px;height:132px;margin:0 auto}
  .head{font-size:42px;font-weight:bold;letter-spacing:1px;line-height:.98;margin-top:0}
  .sub{font-size:13.5px;letter-spacing:3px;color:#00D4FF;margin-top:5px}
  .foryou{font-size:13px;line-height:1.26;color:#cfd2da;max-width:670px;margin:5px auto 0}
  .foryou b{color:#fff}

  .st{font-size:12px;letter-spacing:5px;color:#9aa;text-align:center;margin:4px 0 4px}
  .st span{color:#39FF14}

  .big3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}
  .card{border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:11px;background:rgba(255,255,255,.03)}
  .card .ic{font-size:23px}
  .card h3{font-size:16.5px;margin-top:4px}
  .card p{font-size:12px;line-height:1.36;color:#c2c6cf;margin-top:4px}
  .card .price{margin-top:5px;font-size:12px;letter-spacing:1px;color:#FFC93C}
  .small2{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:10px}
  .tile{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.02);display:flex;gap:9px;align-items:flex-start;padding-top:8px;padding-bottom:8px}
  .tile .ic{font-size:18px}
  .tile h4{font-size:14px}
  .tile p{font-size:11.5px;line-height:1.32;color:#b9bdc6;margin-top:2px}

  .fd{margin:6px 40px 0;border:1px solid rgba(251,146,60,.28);border-radius:16px;padding:10px 14px;
    background:radial-gradient(ellipse at 20% 0%, rgba(251,146,60,.10), transparent 60%), rgba(251,146,60,.04)}
  .fd .h{display:flex;align-items:baseline;gap:11px}
  .fd .h .t{font-size:27px;font-weight:bold;letter-spacing:1px}
  .fd .h .t .o{color:#FB923C}
  .fd .h .s{font-size:11.5px;letter-spacing:2px;color:#FB923C}
  .fd .body{font-size:12px;line-height:1.32;color:#cfd2da;margin-top:4px}
  .fd .body b{color:#fff}
  .fd .vis{display:flex;gap:12px;align-items:center;margin-top:6px}
  .fd .vis .steps{flex:1;border-radius:9px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
  .fd .vis .steps img{width:100%;display:block}
  .fd .vis .orders img{width:108px;display:block;border-radius:9px;border:1px solid rgba(255,255,255,.08)}

  .found{margin:3px 40px 0;text-align:center;font-size:12px;line-height:1.34;color:#ffe;
    border:1px dashed rgba(57,255,20,.35);border-radius:11px;padding:5px 14px;background:rgba(57,255,20,.04)}
  .found b{color:#39FF14}

  .foot{margin-top:auto;padding:4px 40px 8px;border-top:1px solid rgba(255,255,255,.10);
    background:linear-gradient(0deg, rgba(0,0,0,.45), transparent)}
  .foot .row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
  .foot .cta{font-size:18px;font-weight:bold;line-height:1.08}
  .foot .contact{font-size:12.5px;line-height:1.4;color:#dfe2ea;margin-top:5px}
  .foot .contact .nm{font-weight:bold;color:#fff;font-size:14.5px}
  .foot .llc{margin-top:5px;font-size:10.5px;letter-spacing:2.5px;color:#9aa}
  .foot .qrs{display:flex;gap:14px}
  .foot .q{display:flex;flex-direction:column;align-items:center;gap:4px}
  .foot .q .t{background:#fff;border-radius:10px;padding:6px}
  .foot .q.signup img{width:90px;height:90px;display:block}
  .foot .q.fb img{width:60px;height:60px;display:block}
  .foot .q .l{font-size:9.5px;letter-spacing:1px;color:#cfd2da;text-align:center;max-width:110px}
  .foot .q.signup .l{color:#39FF14;font-weight:bold}
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
  await p.screenshot({ path: path.join(__dirname, "flyer.png") });
  await b.close();
  console.log("flyer.png rendered");
})();
