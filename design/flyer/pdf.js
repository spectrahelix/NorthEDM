// Wrap each finished PNG into a print-ready PDF at its true physical size.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const jobs = [
  { png: path.join(__dirname, "flyer.png"),        pdf: path.join(__dirname, "flyer.pdf"),        w: "8.5in",  h: "11in" },
  { png: path.join(__dirname, "flyer-light.png"),  pdf: path.join(__dirname, "flyer-light.pdf"),  w: "8.5in",  h: "11in" },
  { png: path.join(ROOT, "stickers", "sticker-blended.png"), pdf: path.join(ROOT, "stickers", "sticker.pdf"), w: "2.25in", h: "2.25in" },
];

(async () => {
  const b = await chromium.launch();
  for (const j of jobs) {
    const data = `data:image/png;base64,${fs.readFileSync(j.png).toString("base64")}`;
    const p = await b.newPage();
    await p.setContent(
      `<!doctype html><html><head><style>*{margin:0;padding:0}html,body{width:100%;height:100%}
       img{display:block;width:100%;height:100%;object-fit:cover}</style></head>
       <body><img src="${data}"></body></html>`,
      { waitUntil: "networkidle" }
    );
    await p.pdf({ path: j.pdf, width: j.w, height: j.h, printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    console.log("wrote", path.basename(j.pdf));
    await p.close();
  }
  await b.close();
  console.log("pdfs done");
})();
