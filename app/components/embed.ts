// Turn a pasted media URL (YouTube, SoundCloud, Bandcamp, Spotify, Vimeo) into
// an embeddable iframe src. Returns null when the URL isn't a known embed
// provider, in which case callers render a plain link instead.

export type EmbedInfo = { src: string; kind: "video" | "audio"; provider: string };

export function toEmbed(rawUrl: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = url.searchParams.get("v");
    if (v) return { src: `https://www.youtube.com/embed/${v}`, kind: "video", provider: "YouTube" };
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (id) return { src: `https://www.youtube.com/embed/${id}`, kind: "video", provider: "YouTube" };
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id))
      return { src: `https://player.vimeo.com/video/${id}`, kind: "video", provider: "Vimeo" };
  }

  // Spotify
  if (host === "open.spotify.com") {
    return {
      src: `https://open.spotify.com/embed${url.pathname}`,
      kind: "audio",
      provider: "Spotify",
    };
  }

  // SoundCloud (uses the oEmbed player with the full track URL)
  if (host === "soundcloud.com") {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        url.toString()
      )}&color=%2339FF14&auto_play=false&hide_related=true&show_comments=false`,
      kind: "audio",
      provider: "SoundCloud",
    };
  }

  // Bandcamp — pages carry their own embed markup; we can't derive it from the URL
  // reliably, so treat it as a link.
  return null;
}
