import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import { RankBadge } from "@/app/components/RankBadge";
import type { UserProfile, ArtisanWork } from "@/utils/supabase/user-profiles";

export const metadata = {
  title: "Artisans",
  description:
    "Discover verified NorthEDM artisans — visual artists, musicians, crafters, and makers from the Northeast community. Preview their work.",
};

export default async function ArtisansPage() {
  const supabase = await createClient();

  const { data: artisanData } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("is_artisan", true)
    .order("created_at", { ascending: false });

  const artisans = (artisanData ?? []) as UserProfile[];

  // One preview image per artisan (their first image work), fetched in a batch.
  const ids = artisans.map((a) => a.id);
  const previews: Record<string, string> = {};
  if (ids.length) {
    const { data: works } = await supabase
      .from("artisan_works")
      .select("user_id, image_url, kind, sort, created_at")
      .in("user_id", ids)
      .eq("kind", "image")
      .order("sort", { ascending: true });
    for (const w of (works ?? []) as ArtisanWork[]) {
      if (w.image_url && !previews[w.user_id]) previews[w.user_id] = w.image_url;
    }
  }

  return (
    <main className="min-h-screen text-neutral-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(255,201,60,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: "#FFC93C" }}>
            ◈ Artisans
          </p>
          <h1 className="font-bebas text-[clamp(2.5rem,9vw,5rem)] leading-none tracking-wide">
            Makers of the Northeast
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-300">
            Visual artists, musicians, crafters, and DIY makers from the NorthEDM community.
            Verified creators with a peek at their work.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/profile/edit#artisan"
              className="rounded-2xl px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ background: "#FFC93C" }}
            >
              Become an Artisan →
            </Link>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {artisans.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-20 text-center">
            <p className="mb-2 text-3xl">◈</p>
            <p className="text-sm text-neutral-500">
              No verified artisans yet — be the first. Fill out your artisan profile and apply.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {artisans.map((a) => (
              <Link
                key={a.id}
                href={`/profile/${a.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-[#FFC93C]/40 hover:bg-white/[0.05]"
              >
                {/* Preview */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/[0.02]">
                  {previews[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[a.id]}
                      alt={a.stage_name || a.display_name}
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl opacity-40">
                      ◈
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex items-center gap-3 p-4">
                  <AvatarBorder border={a.avatar_border} size={44}>
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatar_url}
                        alt={a.display_name}
                        className="rounded-full object-cover"
                        style={{ width: 44, height: 44 }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-full bg-neutral-800 font-bebas text-lg text-[#FFC93C]"
                        style={{ width: 44, height: 44 }}
                      >
                        {a.display_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </AvatarBorder>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bebas text-xl tracking-wide" style={{ color: "#FFC93C" }}>
                      {a.stage_name || a.display_name}
                    </p>
                    {a.artisan_craft && (
                      <p className="truncate font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {a.artisan_craft}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
