// Social broadcast connectors. Each posts to one destination and is active only
// when its env is configured. Buffer fans out to the mainstream networks
// (Instagram/Facebook/X/TikTok) that require approved apps + OAuth — you connect
// those inside Buffer once. Discord/Telegram/Mastodon post directly (no app
// review). Everything is best-effort: a failing connector never blocks the rest.

export type ConnectorResult = { platform: string; ok: boolean; detail: string };

export type ConnectorInfo = { key: string; label: string; configured: boolean; note: string };

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

// What's wired right now — surfaced in the admin composer so you know where a
// post will actually go.
export function connectorStatus(): ConnectorInfo[] {
  return [
    { key: "buffer",   label: "Buffer (IG · FB · X · TikTok · more)", configured: !!(env("BUFFER_ACCESS_TOKEN") && env("BUFFER_PROFILE_IDS")), note: "Set BUFFER_ACCESS_TOKEN + BUFFER_PROFILE_IDS (comma-separated profile ids)." },
    { key: "discord",  label: "Discord",  configured: !!env("DISCORD_WEBHOOK_URL"), note: "Set DISCORD_WEBHOOK_URL (a channel webhook)." },
    { key: "telegram", label: "Telegram", configured: !!(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID")), note: "Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID." },
    { key: "mastodon", label: "Mastodon", configured: !!(env("MASTODON_BASE_URL") && env("MASTODON_ACCESS_TOKEN")), note: "Set MASTODON_BASE_URL + MASTODON_ACCESS_TOKEN." },
  ];
}

async function toBuffer(text: string, imageUrl?: string): Promise<ConnectorResult[]> {
  const token = env("BUFFER_ACCESS_TOKEN");
  const ids = env("BUFFER_PROFILE_IDS");
  if (!token || !ids) return [];
  const body = new URLSearchParams();
  body.set("text", text);
  body.set("access_token", token);
  for (const id of ids.split(",").map((s) => s.trim()).filter(Boolean)) body.append("profile_ids[]", id);
  if (imageUrl) body.set("media[photo]", imageUrl);
  try {
    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const j = await res.json().catch(() => ({}));
    return [{ platform: "Buffer", ok: res.ok && j.success !== false, detail: res.ok ? `queued to ${ids.split(",").length} profile(s)` : (j.message || `HTTP ${res.status}`) }];
  } catch (e) {
    return [{ platform: "Buffer", ok: false, detail: (e as Error).message }];
  }
}

async function toDiscord(text: string, imageUrl?: string): Promise<ConnectorResult[]> {
  const url = env("DISCORD_WEBHOOK_URL");
  if (!url) return [];
  try {
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: imageUrl ? `${text}\n${imageUrl}` : text }),
    });
    return [{ platform: "Discord", ok: res.ok, detail: res.ok ? "posted" : `HTTP ${res.status}` }];
  } catch (e) {
    return [{ platform: "Discord", ok: false, detail: (e as Error).message }];
  }
}

async function toTelegram(text: string, imageUrl?: string): Promise<ConnectorResult[]> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return [];
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: imageUrl ? `${text}\n${imageUrl}` : text, disable_web_page_preview: false }),
    });
    return [{ platform: "Telegram", ok: res.ok, detail: res.ok ? "posted" : `HTTP ${res.status}` }];
  } catch (e) {
    return [{ platform: "Telegram", ok: false, detail: (e as Error).message }];
  }
}

async function toMastodon(text: string): Promise<ConnectorResult[]> {
  const base = env("MASTODON_BASE_URL");
  const token = env("MASTODON_ACCESS_TOKEN");
  if (!base || !token) return [];
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/statuses`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: text }),
    });
    return [{ platform: "Mastodon", ok: res.ok, detail: res.ok ? "posted" : `HTTP ${res.status}` }];
  } catch (e) {
    return [{ platform: "Mastodon", ok: false, detail: (e as Error).message }];
  }
}

// Fan out a post to every configured connector. Returns a per-destination result.
export async function broadcast(text: string, imageUrl?: string): Promise<ConnectorResult[]> {
  const batches = await Promise.all([
    toBuffer(text, imageUrl),
    toDiscord(text, imageUrl),
    toTelegram(text, imageUrl),
    toMastodon(text),
  ]);
  return batches.flat();
}
