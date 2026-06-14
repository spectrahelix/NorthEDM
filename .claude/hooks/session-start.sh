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

# Auto-auth Supabase CLI if access token is available
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Supabase access token found — CLI ready."
  # supabase CLI uses SUPABASE_ACCESS_TOKEN env var automatically
else
  echo "⚠ SUPABASE_ACCESS_TOKEN not set — add it for CLI migrations."
fi

echo "Session start complete."
