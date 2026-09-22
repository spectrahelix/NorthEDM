"use client";
import { createClient } from "@/utils/supabase/client";

type Provider = "google" | "apple" | "discord" | "facebook";

/**
 * Only providers actually enabled in the Supabase dashboard belong here.
 *
 * Apple and Discord were being rendered while disabled server-side, so tapping
 * either sent the visitor to a raw JSON error page:
 *   {"code":400,"error_code":"validation_failed",
 *    "msg":"Unsupported provider: provider is not enabled"}
 * — on the signup screen, which is the worst possible place for it.
 *
 * A button listed here that Supabase does not have turned on is therefore a
 * broken signup screen, not a cosmetic bug. `npm run check:auth` asks the live
 * project which providers actually answer and fails if this list disagrees —
 * run it after changing this line, and after enabling anything in the
 * dashboard. Adding credentials in Supabase is what turns a provider on; this
 * list only decides whether we draw the button for it.
 */
const ENABLED: Provider[] = ["google"];

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M14.93 9.617c-.022-2.38 1.942-3.526 2.03-3.583-1.107-1.62-2.83-1.841-3.443-1.864-1.463-.149-2.863.864-3.607.864-.744 0-1.89-.845-3.107-.821-1.596.023-3.07.928-3.89 2.358-1.662 2.88-.424 7.14 1.194 9.479.793 1.147 1.738 2.432 2.981 2.385 1.196-.048 1.645-.772 3.09-.772 1.444 0 1.848.772 3.107.748 1.288-.022 2.101-1.17 2.889-2.32a12.16 12.16 0 001.312-2.677c-.028-.013-2.529-.97-2.556-3.797zM12.56 2.9c.658-.796 1.1-1.903.979-3.006-.947.039-2.092.63-2.771 1.426-.607.702-1.14 1.826-.997 2.902 1.057.082 2.137-.537 2.789-1.322z"/>
      </svg>
    ),
  },
  {
    id: "discord",
    label: "Discord",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path d="M15.255 2.268A14.88 14.88 0 0011.523 1a.056.056 0 00-.059.028 10.35 10.35 0 00-.457.939 13.733 13.733 0 00-4.124 0 9.483 9.483 0 00-.464-.939.058.058 0 00-.059-.028 14.842 14.842 0 00-3.732 1.268.052.052 0 00-.024.021C.513 6.1-.307 9.82.095 13.492a.062.062 0 00.023.042 14.954 14.954 0 004.5 2.274.058.058 0 00.063-.021c.347-.473.655-.972.92-1.497a.057.057 0 00-.031-.079 9.843 9.843 0 01-1.408-.671.058.058 0 01-.006-.096c.095-.071.19-.145.28-.22a.055.055 0 01.058-.008c2.954 1.349 6.152 1.349 9.07 0a.055.055 0 01.059.007c.09.075.185.15.281.221a.058.058 0 01-.005.096 9.247 9.247 0 01-1.409.67.057.057 0 00-.03.08c.27.524.578 1.023.919 1.496a.057.057 0 00.063.022 14.907 14.907 0 004.507-2.274.058.058 0 00.023-.041c.468-4.298-.784-8.031-3.313-11.224a.046.046 0 00-.023-.021zM6.018 11.217c-.889 0-1.621-.815-1.621-1.816s.717-1.816 1.621-1.816c.91 0 1.636.822 1.621 1.816 0 1.001-.717 1.816-1.621 1.816zm5.993 0c-.889 0-1.621-.815-1.621-1.816s.717-1.816 1.621-1.816c.91 0 1.636.822 1.621 1.816 0 1.001-.711 1.816-1.621 1.816z"/>
      </svg>
    ),
  },
];

export function SocialAuth({ next = "/feed" }: { next?: string }) {
  async function signInWith(provider: Provider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.filter((p) => ENABLED.includes(p.id)).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signInWith(p.id)}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.07] hover:border-white/20 active:scale-[0.98]"
        >
          {p.icon}
          Continue with {p.label}
        </button>
      ))}
    </div>
  );
}
