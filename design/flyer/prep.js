// Flyer assets: QR codes (home, signup, facebook) + cropped FestDash workflow visuals.
const QR = require("qrcode");
const sharp = require("sharp");
const path = require("path");
const DIR = __dirname;

(async () => {
  // QR codes — dark modules on white for scannability.
  const qrOpts = { errorCorrectionLevel: "H", margin: 1, width: 600, color: { dark: "#0a0a0cff", light: "#ffffffff" } };
  await QR.toFile(path.join(DIR, "qr-home.png"), "https://www.northedm.com", qrOpts);
  await QR.toFile(path.join(DIR, "qr-signup.png"), "https://www.northedm.com/signup", qrOpts);
  await QR.toFile(path.join(DIR, "qr-facebook.png"), "https://www.facebook.com/share/1bKHvtxrCa/", qrOpts);
  console.log("qrs done");

  // FestDash screenshot is 1080x1920. Crop the two useful bands.
  const SRC = path.join(DIR, "..", "play-store", "04-festdash.png");
  // 1) "How it works" — 4 step cards (approx y 820..1090)
  await sharp(SRC).extract({ left: 40, top: 815, width: 1000, height: 285 })
    .toFile(path.join(DIR, "fd-steps.png"));
  // 2) Live vendor orders panel (approx x 672..986, y 1255..1552)
  await sharp(SRC).extract({ left: 668, top: 1258, width: 320, height: 300 })
    .toFile(path.join(DIR, "fd-orders.png"));
  console.log("crops done");
})();
