import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Social",
  description: "Follow NorthEDM everywhere — every account, one place.",
  openGraph: { title: "NorthEDM · Social", description: "Follow NorthEDM everywhere — every account, one place.", url: "https://northedm.com/social" },
};

export const dynamic = "force-dynamic";

type Account = { id: string; platform: string; label: string | null; url: string };

// platform → display + accent. Falls back gracefully for anything not listed.
const META: Record<string, { name: string; icon: string; color: string }> = {
  instagram: { name: "Instagram", icon: "◎", color: "#E1306C" },
  tiktok:    { name: "TikTok",    icon: "♪", color: "#00F2EA" },
  youtube:   { name: "YouTube",   icon: "▶", color: "#FF0000" },
  facebook:  { name: "Facebook",  icon: "f", color: "#1877F2" },
  x:         { name: "X",         icon: "𝕏", color: "#e7e7e7" },
  twitter:   { name: "X",         icon: "𝕏", color: "#e7e7e7" },
  threads:   { name: "Threads",   icon: "@", color: "#e7e7e7" },
  discord:   { name: "Discord",   icon: "◈", color: "#5865F2" },
  telegram:  { name: "Telegram",  icon: "✈", color: "#26A5E4" },
  twitch:    { name: "Twitch",    icon: "▰", color: "#9146FF" },
  spotify:   { name: "Spotify",   icon: "♫", color: "#1DB954" },
  soundcloud:{ name: "SoundCloud",icon: "☁", color: "#FF5500" },
  snapchat:  { name: "Snapchat",  icon: "◕", color: "#FFFC00" },
  bluesky:   { name: "Bluesky",   icon: "❋", color: "#0085FF" },
  mastodon:  { name: "Mastodon",  icon: "◆", color: "#6364FF" },
  linkedin:  { name: "LinkedIn",  icon: "in", color: "#0A66C2" },
  website:   { name: "Website",   icon: "⌘", color: "#39FF14" },
};

export default async function SocialPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("id, platform, label, url")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const accounts = (data ?? []) as Account[];

  return (
    <main className="min-h-screen text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#CC00FF]">NorthEDM</p>
          <h1 className="mt-3 font-bebas text-7xl tracking-wide md:text-8xl">Follow the Movement</h1>
          <p className="mx-auto mt-4 max-w-xl text-neutral-400">
            Every NorthEDM account, one place. Tap in wherever you live online.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-neutral-500">
            Accounts are being connected — check back soon.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => {
              const m = META[a.platform] ?? { name: a.platform, icon: "◇", color: "#8a91a0" };
              return (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
                  style={{ borderColor: `${m.color}33` }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold"
                    style={{ color: m.color, background: `${m.color}1a` }}
                  >
                    {m.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{m.name}</span>
                    <span className="block truncate font-dm-mono text-xs text-neutral-500">
                      {a.label || a.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  </span>
                  <span className="shrink-0 font-dm-mono text-xs text-neutral-600 transition group-hover:text-white">→</span>
                </a>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-[#3AFFD4]/20 bg-[#3AFFD4]/[0.04] p-6 text-center">
          <p className="text-sm text-neutral-300">Running a booth, a set, or a shop?</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link href="/festdash" className="rounded-xl bg-[#3AFFD4] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90">Explore FestDash</Link>
            <Link href="/marketplace" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">Marketplace</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
