import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Who is allowed to submit things.
 *
 * The rule across the site: anything that writes user-generated content —
 * service requests, bug reports, feedback, show listings — requires a signed-in
 * account with a CONFIRMED email. Not merely signed in: confirmed. An
 * unconfirmed account costs a bot nothing to create, so "logged in" on its own
 * is not a trust signal; clearing an email round-trip is.
 *
 * The one deliberate exception is the sign-in help form (/signin-help), which
 * has to work for people who cannot get into an account at all. That path is
 * guarded by content heuristics instead — see utils/botEmail.ts.
 *
 * This is enforced twice on purpose: here at the API edge for a clear error
 * message, and again in RLS (`public.is_verified()`) so a direct PostgREST call
 * can't walk around the route.
 */

export type GateResult =
  | { ok: true; user: User }
  | { ok: false; status: number; error: string; reason: "anonymous" | "unverified" };

export async function requireVerifiedUser(supabase: SupabaseClient): Promise<GateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      reason: "anonymous",
      error: "Please sign in to submit this.",
    };
  }

  // Supabase sets email_confirmed_at when the confirmation link is clicked.
  // OAuth accounts (Google) arrive already confirmed, so they pass cleanly.
  if (!user.email_confirmed_at) {
    return {
      ok: false,
      status: 403,
      reason: "unverified",
      error:
        "Please confirm your email first — check your inbox for the link we sent when you signed up.",
    };
  }

  return { ok: true, user };
}
