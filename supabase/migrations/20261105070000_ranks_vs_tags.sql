-- Ranks vs tags (owner, 2026-11-05). A rank is where someone stands on the site
-- (drifter / wanderer / warden / archon); Merchant and Promoter are tags anyone
-- can hold. Move people whose rank was merchant or promoter to wanderer and keep
-- the same abilities as tags, stored where canSell()/hasRank() already read them.
-- The tag columns are kept by protect_role_flags unless the writer is the
-- service role, so the migration says it is (applied this way on 2026-11-05).
select set_config('request.jwt.claim.role', 'service_role', true), set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.user_profiles
   set role = 'wanderer',
       is_marketplace = true,
       extra_ranks = array(select distinct unnest(coalesce(extra_ranks, '{}') || array['merchant']))
 where role = 'merchant';

update public.user_profiles
   set role = 'wanderer',
       is_promoter = true,
       extra_ranks = array(select distinct unnest(coalesce(extra_ranks, '{}') || array['promoter']))
 where role = 'promoter';

-- Wanderer is a rank now, never a tag.
update public.user_profiles
   set extra_ranks = array_remove(extra_ranks, 'wanderer')
 where 'wanderer' = any(extra_ranks);
