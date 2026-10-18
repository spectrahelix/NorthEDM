-- Per-shop identity: a background theme and a display font, chosen by the
-- NorthEDM owner when setting a vendor's site up (values are keys into
-- utils/storeThemes.ts and utils/storeFonts.ts; the API rejects anything
-- else). 'northedm' is the site's own look, the default for every store.
-- allow_custom_font is the shop operator's switch; guests have their own
-- per-device switch (the ne_shop_fonts cookie). Either one off → standard font.
alter table public.stores
  add column if not exists theme text not null default 'northedm',
  add column if not exists font text,
  add column if not exists allow_custom_font boolean not null default true;
