"use client";
import { COUNTRIES } from "@/utils/shipping";
import { SPEC_KEYS } from "@/utils/specs";

/** Form state for the specification fields; `specs` is an ordered list so a seller can add rows. */
export type SpecsForm = { weightG: string; lengthCm: string; widthCm: string; heightCm: string; hsCode: string; originCountry: string; specs: { key: string; value: string }[] };
export const EMPTY_SPECS_FORM: SpecsForm = { weightG: "", lengthCm: "", widthCm: "", heightCm: "", hsCode: "", originCountry: "US", specs: [] };

export function specsFormFrom(p: { weight_g?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null; hs_code?: string | null; origin_country?: string | null; specs?: Record<string, string> | null } | null | undefined): SpecsForm {
  if (!p) return { ...EMPTY_SPECS_FORM };
  const s = (v: number | null | undefined) => (v == null ? "" : String(v));
  return { weightG: s(p.weight_g), lengthCm: s(p.length_cm), widthCm: s(p.width_cm), heightCm: s(p.height_cm), hsCode: p.hs_code ?? "", originCountry: p.origin_country || "US", specs: Object.entries(p.specs ?? {}).map(([key, value]) => ({ key, value })) };
}
/** The payload the product APIs read (see utils/specs.ts specsPatch). */
export function specsPayload(f: SpecsForm) {
  return { weightG: f.weightG, lengthCm: f.lengthCm, widthCm: f.widthCm, heightCm: f.heightCm, hsCode: f.hsCode, originCountry: f.originCountry, specs: f.specs };
}

const inp = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none";

export function SpecsEditor({ value, onChange }: { value: SpecsForm; onChange: (v: SpecsForm) => void }) {
  const set = (patch: Partial<SpecsForm>) => onChange({ ...value, ...patch });
  const rows = value.specs;
  const setRow = (i: number, patch: Partial<{ key: string; value: string }>) => set({ specs: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const unused = SPEC_KEYS.filter((k) => !rows.some((r) => r.key === k));
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Shipping facts</p>
      <p className="mt-1 text-xs text-neutral-500">Weight sets the shipping price the customer sees. Leave it blank and we assume 300 g.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-neutral-400">Weight (g)<input className={inp + " mt-1"} inputMode="numeric" value={value.weightG} onChange={(e) => set({ weightG: e.target.value })} placeholder="300" /></label>
        <label className="text-xs text-neutral-400">Length (cm)<input className={inp + " mt-1"} inputMode="decimal" value={value.lengthCm} onChange={(e) => set({ lengthCm: e.target.value })} /></label>
        <label className="text-xs text-neutral-400">Width (cm)<input className={inp + " mt-1"} inputMode="decimal" value={value.widthCm} onChange={(e) => set({ widthCm: e.target.value })} /></label>
        <label className="text-xs text-neutral-400">Height (cm)<input className={inp + " mt-1"} inputMode="decimal" value={value.heightCm} onChange={(e) => set({ heightCm: e.target.value })} /></label>
        <label className="text-xs text-neutral-400 sm:col-span-2">Made in<select className={inp + " mt-1"} value={value.originCountry} onChange={(e) => set({ originCountry: e.target.value })}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label className="text-xs text-neutral-400 sm:col-span-2">HS / tariff code (international customs, optional)<input className={inp + " mt-1"} value={value.hsCode} onChange={(e) => set({ hsCode: e.target.value })} placeholder="e.g. 6110.20" /></label>
      </div>
      <p className="mt-5 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Product specifications</p>
      <p className="mt-1 text-xs text-neutral-500">Shown as a table on the item page, like a product&apos;s spec sheet. Add the ones that apply.</p>
      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input className={inp + " w-2/5"} list="spec-keys" value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} placeholder="Spec" />
            <input className={inp} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} placeholder="Value" />
            <button type="button" aria-label="Remove" onClick={() => set({ specs: rows.filter((_, j) => j !== i) })} className="shrink-0 rounded-xl border border-white/10 px-3 text-neutral-400 hover:text-white">×</button>
          </div>
        ))}
        <datalist id="spec-keys">{SPEC_KEYS.map((k) => <option key={k} value={k} />)}</datalist>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {unused.slice(0, 10).map((k) => (
          <button type="button" key={k} onClick={() => set({ specs: [...rows, { key: k, value: "" }] })} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-white/5">+ {k}</button>
        ))}
        <button type="button" onClick={() => set({ specs: [...rows, { key: "", value: "" }] })} className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-xs text-neutral-400 hover:bg-white/5">+ Custom</button>
      </div>
    </div>
  );
}
