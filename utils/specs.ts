/**
 * Product specifications — the "Product Specifications" block on every item
 * page (NorthEDM shop and vendor markets), plus the shipping facts the
 * calculator and the customs label need. One shape for `products` and
 * `shop_products`.
 */
export type SpecsColumns = {
  weight_g: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null;
  hs_code: string | null; origin_country: string; specs: Record<string, string>;
};
export const EMPTY_SPECS: SpecsColumns = { weight_g: null, length_cm: null, width_cm: null, height_cm: null, hs_code: null, origin_country: "US", specs: {} };

/** Suggested spec keys, in the order they are shown. Sellers can add their own. */
export const SPEC_KEYS = [
  "Brand", "Model", "Material", "Color", "Size", "Fit", "Capacity", "Quantity in pack", "Scent / flavor",
  "Ingredients", "Care instructions", "Power", "Compatibility", "Age range", "Handmade", "Condition", "Warranty",
];

/** Read the spec fields out of a request body (camelCase or snake_case), leaving out anything not sent. */
export function specsPatch(body: Record<string, unknown>): Partial<SpecsColumns> {
  const out: Partial<SpecsColumns> = {};
  const num = (k: string) => { const v = body[k]; if (v === undefined) return undefined; const n = Number(v); return v === null || v === "" || !Number.isFinite(n) || n < 0 ? null : n; };
  for (const [k, col] of [["weightG", "weight_g"], ["weight_g", "weight_g"], ["lengthCm", "length_cm"], ["length_cm", "length_cm"], ["widthCm", "width_cm"], ["width_cm", "width_cm"], ["heightCm", "height_cm"], ["height_cm", "height_cm"]] as const) {
    const v = num(k);
    if (v !== undefined) (out as Record<string, unknown>)[col] = col === "weight_g" && v !== null ? Math.round(v) : v;
  }
  const hs = body.hsCode ?? body.hs_code;
  if (hs !== undefined) out.hs_code = String(hs ?? "").replace(/[^0-9.]/g, "").slice(0, 12) || null;
  const origin = body.originCountry ?? body.origin_country;
  if (origin !== undefined) out.origin_country = String(origin || "US").toUpperCase().slice(0, 2);
  if (body.specs !== undefined) {
    const raw = body.specs;
    const clean: Record<string, string> = {};
    const entries = Array.isArray(raw) ? (raw as { key?: string; value?: string }[]).map((r) => [r.key, r.value]) : Object.entries((raw ?? {}) as Record<string, unknown>);
    for (const [k, v] of entries) {
      const key = String(k ?? "").trim().slice(0, 40); const val = String(v ?? "").trim().slice(0, 200);
      if (key && val) clean[key] = val;
      if (Object.keys(clean).length >= 30) break;
    }
    out.specs = clean;
  }
  return out;
}

/** Rows for the specifications table: weight/dimensions first, then the seller's own. */
export function specsRows(p: Partial<SpecsColumns> | null | undefined): [string, string][] {
  if (!p) return [];
  const rows: [string, string][] = [];
  if (p.weight_g) rows.push(["Item weight", p.weight_g >= 1000 ? `${(p.weight_g / 1000).toFixed(2)} kg (${(p.weight_g / 453.592).toFixed(2)} lb)` : `${p.weight_g} g (${(p.weight_g / 28.3495).toFixed(1)} oz)`]);
  if (p.length_cm && p.width_cm && p.height_cm) rows.push(["Dimensions", `${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm (${(p.length_cm / 2.54).toFixed(1)} × ${(p.width_cm / 2.54).toFixed(1)} × ${(p.height_cm / 2.54).toFixed(1)} in)`]);
  for (const [k, v] of Object.entries(p.specs ?? {})) rows.push([k, v]);
  if (p.origin_country) rows.push(["Country of origin", p.origin_country]);
  return rows;
}
export const SPECS_SELECT = "weight_g, length_cm, width_cm, height_cm, hs_code, origin_country, specs";
