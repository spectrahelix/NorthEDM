-- The payment-bridge intake now serves any shop as well as coordinators:
-- one row per coordinator (vendor_id null) and one per shop (vendor_id set).
alter table public.coordinator_bridge drop constraint if exists coordinator_bridge_pkey;
alter table public.coordinator_bridge add column if not exists id uuid primary key default gen_random_uuid();
alter table public.coordinator_bridge add column if not exists vendor_id integer references public.vendors(id) on delete cascade;
create unique index if not exists coordinator_bridge_coord_uniq on public.coordinator_bridge (user_id) where vendor_id is null;
create unique index if not exists coordinator_bridge_vendor_uniq on public.coordinator_bridge (vendor_id) where vendor_id is not null;
