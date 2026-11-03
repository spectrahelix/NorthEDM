#!/usr/bin/env node
// Thin CLI over the site's one gematria implementation (utils/numerology/gematria.ts).
//   node gematria.mjs <hebrew text>   → letters, addends, total
//   node gematria.mjs --test          → the site's full test suite (offline)
import { calculateGematria } from "../../../../utils/numerology/gematria.ts";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export { calculateGematria };

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2).join(" ");
  if (arg === "--test") {
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    process.exit(spawnSync(process.execPath, ["--no-warnings", "scripts/test-astro-hebrew.mjs"], { cwd: root, stdio: "inherit" }).status ?? 1);
  } else if (!arg) { console.error("usage: gematria.mjs <hebrew> | --test"); process.exit(2); }
  else console.log(JSON.stringify(calculateGematria(arg), null, 2));
}
