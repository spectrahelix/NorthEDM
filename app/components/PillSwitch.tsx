"use client";

/** A labelled two-way pill: [ Label  Custom | Standard ]. Presentational only. */
export function PillSwitch({ label, value, onChange, disabled, onText = "Custom", offText = "Standard" }: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  onText?: string;
  offText?: string;
}) {
  const seg = (active: boolean) =>
    `rounded-full px-3 py-1 transition ${active ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 py-1 pl-3 pr-1 font-dm-mono text-[10px] uppercase tracking-widest">
      <span className="text-neutral-500">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5">
        <button type="button" role="radio" aria-checked={value} disabled={disabled} onClick={() => !value && onChange(true)} className={seg(value)}>{onText}</button>
        <button type="button" role="radio" aria-checked={!value} disabled={disabled} onClick={() => value && onChange(false)} className={seg(!value)}>{offText}</button>
      </div>
    </div>
  );
}
