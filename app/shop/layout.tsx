import { ShopCart } from "./ShopCart";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ShopCart />
    </>
  );
}
