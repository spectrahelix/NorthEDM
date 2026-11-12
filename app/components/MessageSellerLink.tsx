import Link from "next/link";

type Props = {
  item: { product: number } | { shopItem: string };
  name: string;
  className?: string;
};

export function MessageSellerLink({ item, name, className = "" }: Props) {
  const query = new URLSearchParams("product" in item ? { product: String(item.product) } : item);
  return (
    <Link
      href={`/messages?${query}`}
      prefetch={false}
      aria-label={`Message seller about ${name}`}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-center text-xs font-semibold text-neutral-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      Message seller
    </Link>
  );
}
