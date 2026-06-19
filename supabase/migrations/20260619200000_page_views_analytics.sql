-- ============================================================
-- First-party site traffic analytics
--
-- Lightweight pageview log + a single aggregate RPC that powers the
-- admin traffic dashboard (totals, daily trend, top pages/referrers).
-- Writes happen server-side from /api/track with the service role.
--
-- Idempotent: safe to re-run. APPLY IN SUPABASE before deploying.
-- ============================================================

CREATE TABLE IF NOT EXISTS page_views (
  id          bigserial PRIMARY KEY,
  path        text NOT NULL,
  visitor_id  text,                 -- anonymous per-browser id
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path);

-- Locked down: only the service role (server) reads/writes. RLS on with
-- no policies = clients get nothing; service role bypasses RLS.
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Aggregate overview for the admin dashboard. One round-trip → JSON with
-- window totals, a daily series (last p_days), and top pages/referrers (30d).
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
      ) FROM page_views
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(*)::int AS views,
               count(DISTINCT visitor_id)::int AS visitors
        FROM page_views
        WHERE created_at >= now() - (p_days || ' days')::interval
        GROUP BY 1
      ) d
    ),
    'top_pages', (
      SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
      FROM (
        SELECT path, count(*)::int AS views
        FROM page_views
        WHERE created_at >= now() - interval '30 days'
        GROUP BY path ORDER BY count(*) DESC LIMIT 10
      ) p
    ),
    'top_referrers', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer, count(*)::int AS views
        FROM page_views
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 10
      ) r
    )
  );
$$;

REVOKE ALL ON FUNCTION analytics_overview(int) FROM PUBLIC;
