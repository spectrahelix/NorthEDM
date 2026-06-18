const fs = require("fs");

const C = 200;
const R_OUT = 192;   // outer ring
const R_MID = 184;   // inner of the double ring
const R_IN = 178;    // flower clip boundary
const rC = 36;       // circle radius == lattice spacing (overlap => Flower of Life)

// Dense Flower of Life: every hex-lattice center whose circle falls within the
// boundary, clipped to R_IN (partial petals appear at the rim, like the classic).
const circles = [];
for (let q = -7; q <= 7; q++) {
  for (let rr = -7; rr <= 7; rr++) {
    const x = C + rC * (q + rr / 2);
    const y = C + rC * (rr * Math.sqrt(3) / 2);
    if (Math.hypot(x - C, y - C) <= R_IN) {
      circles.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rC}"/>`);
    }
  }
}
const flower = circles.join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <clipPath id="circ"><circle cx="200" cy="200" r="${R_IN}"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#0e1411"/>
      <stop offset="100%" stop-color="#05080a"/>
    </radialGradient>
    <!-- VIBGYOR-VIB concentric spectrum: target rings from the centre outward -->
    <radialGradient id="roygbiv" gradientUnits="userSpaceOnUse" cx="${C}" cy="${C}" r="${R_IN}">
      <stop offset="0.000" stop-color="#8b00ff"/>
      <stop offset="0.111" stop-color="#4b00ff"/>
      <stop offset="0.222" stop-color="#0a84ff"/>
      <stop offset="0.333" stop-color="#28e000"/>
      <stop offset="0.444" stop-color="#ffe600"/>
      <stop offset="0.556" stop-color="#ff8a00"/>
      <stop offset="0.667" stop-color="#ff0000"/>
      <stop offset="0.778" stop-color="#8b00ff"/>
      <stop offset="0.889" stop-color="#4b00ff"/>
      <stop offset="1.000" stop-color="#0a84ff"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <circle cx="200" cy="200" r="${R_IN}" fill="url(#bg)"/>

  <g clip-path="url(#circ)" fill="none" stroke="url(#roygbiv)" stroke-width="2" stroke-opacity="0.97">
    ${flower}
  </g>

  <!-- black bar + wordmark -->
  <g clip-path="url(#circ)">
    <rect x="0" y="168" width="400" height="64" fill="#000000" fill-opacity="0.9"/>
  </g>
  <text x="200" y="214" text-anchor="middle" font-family="'Bebas Neue','Arial Narrow',sans-serif"
        fill="#39ff14" letter-spacing="1.5" filter="url(#glow)">
    <tspan font-size="52">N</tspan><tspan font-size="41">orth</tspan><tspan font-size="52">EDM</tspan>
  </text>

  <!-- double neon ring frame -->
  <circle cx="200" cy="200" r="${R_OUT}" fill="none" stroke="#39ff14" stroke-width="3" stroke-opacity="0.9"/>
  <circle cx="200" cy="200" r="${R_MID}" fill="none" stroke="#39ff14" stroke-width="1.5" stroke-opacity="0.7"/>
</svg>`;

fs.writeFileSync("design/northedm-logo.svg", svg);
console.log("wrote design/northedm-logo.svg with", circles.length, "flower circles");
