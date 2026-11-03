import { specsRows, type SpecsColumns } from "@/utils/specs";

/** "Product Specifications" on an item page — only renders when there is something to show. */
export function SpecsTable({ product, className = "" }: { product: Partial<SpecsColumns> | null | undefined; className?: string }) {
  const rows = specsRows(product);
  if (!rows.length) return null;
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.02] ${className}`}>
      <p className="border-b border-white/10 px-4 py-2.5 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Product specifications</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-white/5 last:border-0">
              <th scope="row" className="w-2/5 px-4 py-2 text-left font-medium text-neutral-400">{k}</th>
              <td className="px-4 py-2 text-neutral-200">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
