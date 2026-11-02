"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { safeNext } from "@/utils/safeRedirect";

// Where /auth/callback sends a sign-in it could not finish itself. On 2026-11-02
// a Google sign-in in Chrome loaded the callback twice a second apart: the first
// load redeemed the one-time code and set the session, the second found the code
// spent, had no session of its own, and bounced to /login with "link expired"
// while the person was in fact signed in. The server cannot see cookies another
// response just set, but the browser can — so decide here, client-side.
function Finish() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const next = safeNext(params.get("next"));
    const supabase = createClient();
    let tries = 0;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { router.replace(next); return; }
      if (++tries < 4) { setTimeout(check, 500); return; }
      router.replace(`/login?error=oauth_incomplete&next=${encodeURIComponent(next)}`);
    };
    check();
  }, [params, router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
      Finishing sign-in…
    </main>
  );
}

export default function AuthFinishPage() {
  return <Suspense fallback={null}><Finish /></Suspense>;
}
