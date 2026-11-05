import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { myStoreSlug } from "@/utils/myStore";
import { BRAND_SHOP_PATH } from "@/utils/brandShop";

export const metadata = {
  title: "Shop",
  description: "Official NorthEDM gear and goods.",
};

// /shop is NorthEDM's brand shop (utils/brandShop.ts). A shop owner's "Shop"
// is their own storefront instead: /shop → /franks, /Gees … Admins and
// everyone else land on the NorthEDM shop.
export default async function ShopPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: me } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = me?.role === "archon" || me?.role === "warden";
    if (!isAdmin) {
      const mine = await myStoreSlug(serviceClient(), user.id);
      if (mine) redirect(`/${mine}`);
    }
  }
  redirect(BRAND_SHOP_PATH);
}
