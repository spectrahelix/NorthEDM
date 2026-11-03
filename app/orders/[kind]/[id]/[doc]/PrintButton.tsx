"use client";
export function PrintButton({ note }: { note?: string }) {
  return (
    <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-4 text-xs text-neutral-700 print:hidden">
      <span>{note ?? "Use your browser's Print to save as PDF."}</span>
      <button onClick={() => window.print()} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Print</button>
    </div>
  );
}
