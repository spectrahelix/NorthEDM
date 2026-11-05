/**
 * NorthEDM's main brand shop (owner's decision, 2026-11-05): the marketplace
 * vendor "NorthEDM" (vendor 37), run from the owner's archon account like any
 * other shop — items on /vendor/dashboard, profile and metrics on /vendor.
 * `/shop` sends everyone here (a shop owner's own /shop still goes to their
 * store). The older `shop_products` storefront it replaces held no products.
 */
export const BRAND_SHOP_VENDOR_ID = 37;
export const BRAND_SHOP_PATH = `/marketplace/${BRAND_SHOP_VENDOR_ID}`;
