const fs = require("fs");

const C = 200, R = 190;
const d = 58; // circle radius == lattice spacing (overlapping = Flower of Life)

// Flower of Life: hex-lattice centers with axial distance <= 2  (1 + 6 + 12 = 19)
const centers = [];
for (let q = -2; q <= 2; q++) {
  for (let r = -2; r <= 2; r++) {
    const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
    if (dist <= 2) {
      const x = C + d * (q + r / 2);
      const y = C + d * (r * Math.sqrt(3) / 2);
      centers.push([x, y]);
    }
  }
}

const palette = ["#ff3b30","#ff9500","#ffd60a","#34c759","#00c7be","#32ade6",
                 "#0a84ff","#5e5ce6","#bf5af2","#ff375f","#ff6482","#66d4cf"];

let flower = "";
centers.forEach(([x, y], i) => {
  flower += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${d}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="2.2" stroke-opacity="0.92"/>`;
});

// Translucent alpine forest — treeline declines left -> right (top-y grows with x)
const hill = (yL, yR, op, col) =>
  `<path d="M 0 ${yL} L 400 ${yR} L 400 400 L 0 400 Z" fill="${col}" fill-opacity="${op}"/>`;

const pines = (yLtop, yRtop, count, h, col, op) => {
  let p = "";
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = 16 + t * 368;
    const topY = yLtop + t * (yRtop - yLtop);
    const w = h * 0.55;
    const baseY = topY + h;
    p += `<path d="M ${x.toFixed(1)} ${topY.toFixed(1)} L ${(x - w).toFixed(1)} ${baseY.toFixed(1)} L ${(x + w).toFixed(1)} ${baseY.toFixed(1)} Z" fill="${col}" fill-opacity="${op}"/>`;
  }
  return p;
};

const forest =
  hill(208, 286, 0.30, "#13513c") +
  pines(220, 298, 11, 36, 0.34, "#0c3f2e") +
  hill(252, 326, 0.42, "#0a2e23") +
  pines(262, 336, 14, 26, 0.42, "#08251d");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <clipPath id="circ"><circle cx="200" cy="200" r="${R}"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#0e1411"/>
      <stop offset="100%" stop-color="#05080a"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <g clip-path="url(#circ)">
    <circle cx="200" cy="200" r="${R}" fill="url(#bg)"/>
    <g style="mix-blend-mode:screen">${flower}</g>
    ${forest}
    <rect x="0" y="171" width="400" height="58" fill="#000000" fill-opacity="0.9"/>
  </g>

  <text x="200" y="211" text-anchor="middle"
        font-family="'Bebas Neue','Arial Narrow',sans-serif" font-size="44"
        font-weight="700" letter-spacing="2.5" fill="#39ff14" filter="url(#glow)">NorthEDM</text>

  <circle cx="200" cy="200" r="${R}" fill="none" stroke="#000" stroke-width="10"/>
  <circle cx="200" cy="200" r="${R - 3}" fill="none" stroke="#39ff14" stroke-width="2.5" stroke-opacity="0.85"/>
</svg>`;

fs.writeFileSync("design/northedm-logo.svg", svg);
console.log("wrote design/northedm-logo.svg with", centers.length, "flower circles");
