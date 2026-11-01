import base64, io, sys
# pip install segno   (pure-python QR codes)
import segno

SETUP = "https://www.northedm.com/festdash/shop-setup?ref=T7KTWYN"
FESTDASH = "https://www.northedm.com/festdash"

def qr_data_uri(url, scale=12):
    buf = io.BytesIO()
    segno.make(url, error="m").save(buf, kind="png", scale=scale, border=2, dark="#111111", light="#ffffff")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

q1, q2 = qr_data_uri(SETUP), qr_data_uri(FESTDASH, scale=9)
html = f"""<!doctype html><html><head><meta charset="utf-8"><title>FestDash — Sell to your whole town</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family: Inter, Arial, sans-serif; color:#111; background:#fff; width:210mm; height:297mm; }}
  .page {{ width:210mm; height:297mm; padding:0; display:flex; flex-direction:column; }}
  .band {{ background:#0b0b0f; color:#fff; padding:14mm 14mm 10mm; display:flex; align-items:center; justify-content:space-between; }}
  .band img {{ height:22mm; }}
  .band .t {{ text-align:right; }}
  .band h1 {{ font-family:'Bebas Neue', Impact, sans-serif; font-size:64px; line-height:.9; margin:0; letter-spacing:.5px; }}
  .band h1 span {{ color:#f97316; }}
  .band p {{ margin:4px 0 0; color:#c7c7cc; font-size:13px; letter-spacing:.14em; text-transform:uppercase; }}
  .body {{ padding:9mm 14mm 6mm; display:grid; grid-template-columns: 1.15fr 1fr; gap:9mm; flex:1; }}
  h2 {{ font-family:'Bebas Neue', Impact, sans-serif; font-size:28px; letter-spacing:.5px; margin:0 0 4mm; color:#111; }}
  h2 span {{ color:#f97316; }}
  ol {{ margin:0; padding:0; list-style:none; counter-reset: s; }}
  ol li {{ counter-increment:s; position:relative; padding-left:12mm; margin-bottom:4.2mm; font-size:12.5px; line-height:1.38; }}
  ol li::before {{ content: counter(s); position:absolute; left:0; top:-1px; width:8.5mm; height:8.5mm; border-radius:50%; background:#f97316; color:#fff; font-family:'Bebas Neue'; font-size:19px; display:flex; align-items:center; justify-content:center; }}
  ol li b {{ display:block; font-size:13.5px; margin-bottom:1px; }}
  .box {{ border:1.2px solid #e5e5e5; border-radius:14px; padding:5mm 5.5mm; margin-bottom:5mm; }}
  .box h3 {{ font-family:'Bebas Neue'; font-size:20px; margin:0 0 2.5mm; letter-spacing:.4px; }}
  .box h3 span {{ color:#f97316; }}
  .kv {{ display:grid; grid-template-columns:auto 1fr; gap:1.6mm 4mm; font-size:12px; }}
  .kv dt {{ font-weight:700; }}
  .kv dd {{ margin:0; }}
  .pay {{ display:grid; grid-template-columns:1fr 1fr; gap:2mm 4mm; font-size:11.3px; }}
  .pay div b {{ display:block; font-size:12px; }}
  .qr {{ display:flex; gap:5mm; align-items:center; }}
  .qr img {{ width:38mm; height:38mm; border:1px solid #eee; border-radius:8px; }}
  .qr .big img {{ width:52mm; height:52mm; }}
  .qr p {{ margin:0; font-size:12px; }}
  .qr .url {{ font-family: ui-monospace, Menlo, monospace; font-size:10.5px; color:#555; word-break:break-all; }}
  .start {{ background:#fff7ed; border-color:#fdba74; }}
  .coord {{ margin:0 14mm 6mm; border:1.5px dashed #bbb; border-radius:14px; padding:4.5mm 6mm; display:grid; grid-template-columns:1fr 1fr 1fr; gap:4mm; font-size:12px; }}
  .coord b {{ display:block; font-family:'Bebas Neue'; font-size:17px; letter-spacing:.4px; color:#f97316; margin-bottom:1mm; }}
  .coord .line {{ border-bottom:1.2px solid #999; height:7mm; }}
  .foot {{ background:#0b0b0f; color:#9a9aa3; font-size:9.6px; padding:4.5mm 14mm; line-height:1.45; }}
  .foot b {{ color:#fff; }}
</style></head><body><div class="page">
  <div class="band">
    <img src="/northedm-logo.svg" alt="NorthEDM">
    <div class="t"><h1>FEST<span>DASH</span></h1><p>Sell to your whole town · Delivered · The Gambia</p></div>
  </div>
  <div class="body">
    <div>
      <h2>How it <span>works</span></h2>
      <ol>
        <li><b>Scan the code and create your free account.</b> Email or Google. It takes a minute and brings you straight to the shop set-up page, already linked to Gee.</li>
        <li><b>Tell us about your shop.</b> What you sell, your area, your WhatsApp number, and the wallet where you want your money paid (Wave, QMoney or Afrimoney).</li>
        <li><b>Your coordinator confirms you.</b> They visit, answer your questions, and collect the first month's listing fee. NorthEDM approves your shop.</li>
        <li><b>Add your items.</b> A photo and a price in dalasi for each. Your shop goes live on FestDash.</li>
        <li><b>Customers order, a runner delivers, you get paid.</b> People nearby order on the website or by WhatsApp and pay by Wave, QMoney, Afrimoney or cash on delivery. You hand over with a 4-digit code and keep 80% of every sale.</li>
      </ol>
      <div class="box">
        <h3>What it <span>costs</span> · what you <span>earn</span></h3>
        <dl class="kv">
          <dt>Listing fee</dt><dd>US$30 a month, paid in dalasi to your coordinator. No fee, no listing — stop any time.</dd>
          <dt>Each sale</dt><dd><b>You keep 80%.</b> 10% to your coordinator, 10% to NorthEDM.</dd>
          <dt>Payouts</dt><dd>Your coordinator sends your share to the wallet you chose, on the schedule you agree with them.</dd>
        </dl>
      </div>
    </div>
    <div>
      <div class="box start">
        <h3><span>Start here</span> — set up your shop</h3>
        <div class="qr big"><img src="{q1}" alt="QR: shop set-up"><div><p><b>Scan with your phone camera.</b></p><p style="margin-top:2mm">Create your account, fill in your shop, send the application.</p><p class="url" style="margin-top:2mm">{SETUP}</p></div></div>
      </div>
      <div class="box">
        <h3>See how <span>FestDash</span> works</h3>
        <div class="qr"><img src="{q2}" alt="QR: FestDash"><div><p>What customers see, how ordering and delivery work.</p><p class="url" style="margin-top:2mm">{FESTDASH}</p></div></div>
      </div>
      <div class="box">
        <h3>How customers <span>pay</span></h3>
        <div class="pay">
          <div><b>Wave</b>Usually arrives within moments.</div>
          <div><b>QMoney</b>Usually within minutes; busy times can be longer.</div>
          <div><b>Afrimoney</b>Usually within minutes; busy times can be longer.</div>
          <div><b>Cash on delivery</b>Paid to the runner at handover.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="coord">
    <div><b>Your coordinator</b><div class="line" style="font-size:15px;font-weight:600;line-height:7mm">Gee</div></div>
    <div><b>WhatsApp</b><div class="line"></div></div>
    <div><b>Coordinator code</b><div class="line" style="font-family:ui-monospace,Menlo,monospace;font-size:17px;font-weight:700;letter-spacing:.12em;line-height:7mm">T7KTWYN</div></div>
  </div>
  <div class="foot">
    <b>northedm.com</b> · FestDash™ and FestEats™ are services of NorthEDM LLC. &nbsp;Transfer times are set by each payment provider, not by FestDash or NorthEDM, and can vary; an order starts once your coordinator sees the money in their wallet. Your coordinator collects fees and payments locally and pays you your share; keep your transaction references.
  </div>
</div></body></html>"""
open("flyer.html", "w").write(html)
print("flyer.html written; qr bytes:", len(q1), len(q2))
