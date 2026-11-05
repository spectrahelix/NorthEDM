-- 1) Transfer fee becomes a percentage (owner, 2026-11-05): 3% of the order,
--    replacing the flat remit_fee_usd_cents (dropped once the new code is live).
-- 2) Promoter codes at the NorthEDM brand shop: the buyer saves
--    brand_code_discount_bps (5%) and the code's promoter earns
--    brand_code_commission_bps (5%) of the discounted total — only when their
--    payout account is connected. utils/brandShop.ts.
alter table public.coordinator_program_settings
  add column if not exists remit_fee_bps integer not null default 300 check (remit_fee_bps between 0 and 2000),
  add column if not exists brand_code_discount_bps integer not null default 500 check (brand_code_discount_bps between 0 and 5000),
  add column if not exists brand_code_commission_bps integer not null default 500 check (brand_code_commission_bps between 0 and 5000);
grant select (remit_fee_bps, brand_code_discount_bps, brand_code_commission_bps) on public.coordinator_program_settings to anon, authenticated;

alter table public.store_orders
  add column if not exists promo_code text,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists promoter_user_id uuid;

-- 3) The brand shop sells through an embedded store, like every other shop:
--    /northedm, run by the owner's archon account, vendor 37 its only member.
insert into public.stores (slug, name, tagline, owner_user_id, active, billing_status, platform_fee_bps, operator_fee_bps)
select 'northedm', 'NorthEDM', 'Official NorthEDM gear and goods.', v.user_id, true, 'active', 0, 0
from public.vendors v where v.id = 37 and v.user_id is not null
on conflict (slug) do nothing;
insert into public.store_vendors (store_id, vendor_id, status)
select s.id, 37, 'approved' from public.stores s
where s.slug = 'northedm' and not exists (select 1 from public.store_vendors sv where sv.store_id = s.id and sv.vendor_id = 37);

-- Discount coupons stack with the promoter discount at the brand shop (2026-11-05).
alter table public.store_orders
  add column if not exists voucher_code_id uuid references public.discount_codes(id) on delete set null,
  add column if not exists voucher_cents integer not null default 0;
