#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "Installing npm dependencies..."
npm install

# Auto-auth Vercel CLI if token is available
if [ -n "${VERCEL_TOKEN:-}" ]; then
  echo "Vercel token found — CLI ready."
  # Vercel CLI uses VERCEL_TOKEN env var automatically, no login needed
else
  echo "⚠ VERCEL_TOKEN not set — add it to deploy via CLI."
fi

# Auto-auth + auto-link the Supabase CLI if an access token is available.
#
# This is the FALLBACK PATH for applying migrations when the MCP connector is
# unavailable. The connectors are brokered through the user's claude.ai session,
# so a network blip on their end drops every connector at once (Supabase, Vercel,
# Gmail, Stripe together) and there is nothing this sandbox can do to restore
# them. The CLI runs entirely inside the sandbox, so it keeps working.
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Supabase access token found — CLI ready."

  # The project ref is not a secret: it's the subdomain in the public
  # NEXT_PUBLIC_SUPABASE_URL. Overridable for a different project/branch.
  SUPABASE_REF="${SUPABASE_PROJECT_REF:-bacyusmyzyawcrdpnvrt}"

  if [ -f supabase/.temp/project-ref ] && [ "$(cat supabase/.temp/project-ref)" = "$SUPABASE_REF" ]; then
    echo "  Already linked to $SUPABASE_REF."
  # `if cmd; then` is deliberate: under `set -e` a bare failing command would
  # abort the whole hook, and a failed link must never block a session.
  elif npx --yes supabase link --project-ref "$SUPABASE_REF" --yes >/tmp/supabase-link.log 2>&1; then
    echo "  Linked to $SUPABASE_REF — 'supabase db push' is ready."
  else
    echo "  ⚠ supabase link failed (see /tmp/supabase-link.log). MCP connector still works."
  fi

  # `db push` needs the database password; without it the CLI would prompt and
  # hang in a non-interactive session.
  if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
    echo "  ℹ SUPABASE_DB_PASSWORD not set — 'supabase db push' will need it (add it as an env secret)."
  fi
else
  echo "⚠ SUPABASE_ACCESS_TOKEN not set — add it for CLI migrations (works even when the connector drops)."
fi

echo "Session start complete."
