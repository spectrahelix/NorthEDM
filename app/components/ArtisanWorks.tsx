import { toEmbed } from "./embed";
import type { ArtisanWork } from "@/utils/supabase/user-profiles";

// Read-only gallery of an artisan's portfolio works: uploaded images, embedded
// media (YouTube/SoundCloud/Spotify/Vimeo), and external links.
export function ArtisanWorks({ works }: { works: ArtisanWork[] }) {
  if (!works.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {works.map((w) => {
        const embed = w.kind === "embed" && w.url ? toEmbed(w.url) : null;

        return (
          <div
            key={w.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            {w.kind === "image" && w.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.image_url}
                alt={w.title || "Artwork"}
                className="aspect-[4/3] w-full object-cover"
              />
            )}

            {embed && (
              <div className={embed.kind === "video" ? "aspect-video" : ""}>
                <iframe
                  src={embed.src}
                  className="w-full"
                  style={embed.kind === "audio" ? { height: 160 } : { height: "100%" }}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={w.title || embed.provider}
                />
              </div>
            )}

            {(w.kind === "link" || (w.kind === "embed" && !embed)) && w.url && (
              <a
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-white/[0.02] p-6 text-center transition hover:bg-white/[0.05]"
              >
                <span className="text-3xl">🔗</span>
                <span className="break-all font-dm-mono text-xs text-[#FFC93C]">
                  {(() => {
                    try {
                      return new URL(w.url).hostname.replace(/^www\./, "");
                    } catch {
                      return "Open link";
                    }
                  })()}
                </span>
              </a>
            )}

            {(w.title || w.caption) && (
              <div className="p-4">
                {w.title && <p className="font-semibold text-neutral-100">{w.title}</p>}
                {w.caption && (
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">{w.caption}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
