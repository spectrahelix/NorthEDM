# Flyers

Print pieces for coordinators to hand to shops. The PDFs are served from
`public/flyers/` so a coordinator can download theirs any time.

- `festdash-gambia-shop-T7KTWYN.pdf` — Gee's shop flyer (The Gambia). The big
  QR opens `/festdash/shop-setup?ref=T7KTWYN`, so a shop that scans it is
  attributed to him; the small QR opens `/festdash`.
  Live at <https://www.northedm.com/flyers/festdash-gambia-shop-T7KTWYN.pdf>.

To make one for another coordinator: edit `SETUP` (their referral code) and the
coordinator box in `make_flyer.py`, run `pip install segno && python3
make_flyer.py` (writes `flyer.html` with the QR codes embedded), then print it to
A4 PDF with the browser or Playwright (`page.pdf({ format: "A4",
printBackground: true })`). Name the PDF after the code so the link is stable.
