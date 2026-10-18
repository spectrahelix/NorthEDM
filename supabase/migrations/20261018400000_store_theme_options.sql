-- Operators choose their own theme, from the templates the NorthEDM owner
-- made available to their store (theme_options; the standard NorthEDM
-- backdrop is always available). allow_custom_theme is the operator's
-- Custom/Standard theme switch, mirroring allow_custom_font.
alter table public.stores
  add column if not exists theme_options text[] not null default '{}',
  add column if not exists allow_custom_theme boolean not null default true;

-- Frank's four logo-palette templates are his to choose from.
update public.stores
  set theme_options = array['moonlit-midway','campfire-glow','festival-dusk','midway-awning']
  where slug = 'franks';
