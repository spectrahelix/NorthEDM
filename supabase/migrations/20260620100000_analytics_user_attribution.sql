-- ============================================================
-- Analytics: per-user attribution + exclude admins
--
-- Records which logged-in user (if any) each pageview belongs to and
-- whether they're an admin, so the dashboard can drop the owner's own
-- browsing and break out real visitors (members vs guests, top members).
--
-- analytics_overview() now excludes admin views from every metric and
-- adds an 'audience' summary + 'top_members'.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS page_views_user_idx ON page_views (user_id);

CREATE OR REPLACE FUNCTION analytics_overview(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'all_views',      count(*),
        'all_visitors',   count(DISTINCT visitor_id),
        'today_views',    count(*) FILTER (WHERE created_at >= date_trunc('day', now())),
        'today_visitors', count(DISTINCT visitor_id) FILTER (WHERE created_at >= date_trunc('day', now())),
        'd7_views',       count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        'd7_visitors',    count(DISTINCT visitor_id) FILTER (WHERE created_at >= now() - interval '7 days'),
        'd30_views',      count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
        'd30_visitors',   count(DISTINCT visitor_id) FILTER (WHERE created_at >= now() - interval '30 days')
      ) FROM page_views WHERE NOT is_admin
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(*)::int AS views,
               count(DISTINCT visitor_id)::int AS visitors
        FROM page_views
        WHERE NOT is_admin AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY 1
      ) d
    ),
    'top_pages', (
      SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
      FROM (
        SELECT path, count(*)::int AS views
        FROM page_views
        WHERE NOT is_admin AND created_at >= now() - interval '30 days'
        GROUP BY path ORDER BY count(*) DESC LIMIT 10
      ) p
    ),
    'top_referrers', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer, count(*)::int AS views
        FROM page_views
        WHERE NOT is_admin AND created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 10
      ) r
    ),
    'audience', (
      SELECT jsonb_build_object(
        'member_views', count(*) FILTER (WHERE user_id IS NOT NULL),
        'guest_views',  count(*) FILTER (WHERE user_id IS NULL),
        'members',      count(DISTINCT user_id)
      ) FROM page_views
      WHERE NOT is_admin AND created_at >= now() - interval '30 days'
    ),
    'top_members', (
      SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(up.display_name, ''), 'member') AS name, count(*)::int AS views
        FROM page_views pv
        JOIN user_profiles up ON up.id = pv.user_id
        WHERE NOT pv.is_admin AND pv.created_at >= now() - interval '30 days'
        GROUP BY up.display_name
        ORDER BY count(*) DESC LIMIT 10
      ) m
    )
  );
$$;

REVOKE ALL ON FUNCTION analytics_overview(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION analytics_overview(integer) FROM anon, authenticated;
