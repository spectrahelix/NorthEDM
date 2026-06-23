// Generate Play Store graphics: 512x512 app icon + 1024x500 feature graphic.
const sharp = require("sharp");
const path = require("path");

const DIR = __dirname;
const LOGO = path.join(__dirname, "..", "northedm-logo.png");

async function appIcon() {
  // 512x512, dark brand background with the logo filling most of the square.
  const size = 512;
  const bg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color="#0a0a0c"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)"/>
    </svg>`);

  const logo = await sharp(LOGO)
    .resize(496, 496, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(bg)
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(DIR, "app-icon-512.png"));
  console.log("app-icon-512.png");
}

async function featureGraphic() {
  // 1024x500 banner: gradient bg, spectral lines, logo left, wordmark right.
  const W = 1024, H = 500;
  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#08070b"/>
          <stop offset="55%" stop-color="#050506"/>
          <stop offset="100%" stop-color="#020203"/>
        </linearGradient>
        <linearGradient id="word" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#39FF14"/>
          <stop offset="100%" stop-color="#00D4FF"/>
        </linearGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="transparent"/>
          <stop offset="18%" stop-color="#39FF14"/>
          <stop offset="50%" stop-color="#00D4FF"/>
          <stop offset="82%" stop-color="#CC00FF"/>
          <stop offset="100%" stop-color="transparent"/>
        </linearGradient>
        <radialGradient id="aura" cx="32%" cy="50%" r="45%">
          <stop offset="0%" stop-color="rgba(0,212,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(0,212,255,0)"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#aura)"/>
      <rect x="0" y="0" width="${W}" height="3" fill="url(#line)"/>
      <rect x="0" y="${H - 3}" width="${W}" height="3" fill="url(#line)"/>

      <text x="470" y="225" font-family="DejaVu Sans Mono" font-weight="bold"
            font-size="92" letter-spacing="2" fill="url(#word)">NorthEDM</text>
      <text x="474" y="285" font-family="DejaVu Sans Mono" font-size="26"
            letter-spacing="10" fill="#39FF14" opacity="0.65">UNITE THE NORTHEAST</text>
      <text x="474" y="330" font-family="DejaVu Sans Mono" font-size="20"
            letter-spacing="8" fill="#7a7a82">NORTHEAST DANCE MUSIC</text>
      <text x="474" y="392" font-family="DejaVu Sans Mono" font-size="17"
            letter-spacing="1" fill="#9aa">Community · Marketplace · Foraging · FestDash</text>
    </svg>`);

  const logo = await sharp(LOGO)
    .resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(svg)
    .composite([{ input: logo, left: 40, top: 50 }])
    .png()
    .toFile(path.join(DIR, "feature-graphic-1024x500.png"));
  console.log("feature-graphic-1024x500.png");
}

(async () => {
  await appIcon();
  await featureGraphic();
  console.log("graphics done");
})();
