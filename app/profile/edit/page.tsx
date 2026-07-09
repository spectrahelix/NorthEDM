"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  AvatarBorder,
  BORDER_OPTIONS,
  BorderPreview,
  type BorderKey,
} from "@/app/components/AvatarBorder";
import { RankBadge } from "@/app/components/RankBadge";
import { profileTags, type UserProfile } from "@/utils/supabase/user-profiles";
import { TAG_CONFIG, type TagKey } from "@/app/components/roleColors";
import { ArtisanEditor } from "./ArtisanEditor";
import { ShowsEditor } from "./ShowsEditor";

export default function EditProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // New users arrive here with ?welcome=1; after saving, send them to the home page.
  const isWelcome = searchParams.get("welcome") === "1";
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarBorder, setAvatarBorder] = useState<BorderKey>("moss");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const p = data as UserProfile;
            setProfile(p);
            setDisplayName(p.display_name);
            setBio(p.bio);
            setHomeCity(p.home_city);
            setPronouns(p.pronouns || "");
            setWebsite(p.website || "");
            setAvatarBorder((p.avatar_border as BorderKey) || "moss");
            setAvatarUrl(p.avatar_url);
            setHiddenTags(Array.isArray(p.hidden_tags) ? p.hidden_tags : []);
            setFullName(p.full_name || "");
            setPhone(p.phone || "");
            setAddress1(p.address_line1 || "");
            setAddress2(p.address_line2 || "");
            setCity(p.city || "");
            setRegion(p.region || "");
            setPostalCode(p.postal_code || "");
          }
          setLoading(false);
        });
    });
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar must be under 5MB.");
      return;
    }
    setUploading(true);
    setError("");
    const supabase = createClient();
    const path = `${userId}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${publicData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    setUploading(false);
  }

  async function save() {
    if (!userId || !profile) return;
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (bio.length > 280) {
      setError("Bio must be 280 characters or less.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    // Record old name in history before overwriting
    if (displayName.trim() !== profile.display_name) {
      await supabase.from("display_name_history").insert({
        user_id: userId,
        display_name: profile.display_name,
      });
      setProfile({ ...profile, display_name: displayName.trim() });
    }

    const { error: upsertError } = await supabase
      .from("user_profiles")
      .upsert({
        id: userId,
        display_name: displayName.trim(),
        bio: bio.trim(),
        home_city: homeCity.trim(),
        pronouns: pronouns.trim() || null,
        website: website.trim() || null,
        avatar_border: avatarBorder,
        avatar_url: avatarUrl,
        hidden_tags: hiddenTags,
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        postal_code: postalCode.trim() || null,
      });
    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => router.push(isWelcome ? "/" : `/profile/${userId}`), 1000);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="font-dm-mono text-sm text-neutral-500">Loading…</div>
      </main>
    );
  }

  const initials = displayName.slice(0, 2).toUpperCase() || "??";

  return (
    <main className="min-h-screen text-neutral-100">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">
          Profile
        </p>
        <h1 className="mb-8 font-bebas text-5xl tracking-wide">Edit Profile</h1>

        {/* Avatar */}
        <div className="mb-8 flex items-center gap-6">
          <AvatarBorder border={avatarBorder} size={80}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="rounded-full object-cover"
                style={{ width: 80, height: 80 }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full bg-neutral-800 font-bebas text-2xl tracking-wide text-[#3AFFD4]"
                style={{ width: 80, height: 80 }}
              >
                {initials}
              </div>
            )}
          </AvatarBorder>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Change Avatar"}
            </button>
            <button
              onClick={() => router.push("/avatar/builder")}
              className="ml-2 rounded-xl border border-[#3AFFD4]/30 bg-[#3AFFD4]/[0.06] px-4 py-2 text-sm text-[#3AFFD4] transition hover:bg-[#3AFFD4]/10"
            >
              Build Avatar →
            </button>
            <p className="mt-1.5 font-dm-mono text-xs text-neutral-600">
              JPG, PNG, WEBP · max 5MB
            </p>
            {profile && (
              <div className="mt-2">
                <RankBadge role={profile.role} name={displayName || "Your Name"} tags={profileTags(profile)} />
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>

        <div className="space-y-5">
          {/* Display name */}
          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="How you appear to the community"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Bio
              <span className="ml-2 normal-case tracking-normal text-neutral-700">
                {bio.length}/280
              </span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="A little about yourself…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
          </div>

          {/* Home city */}
          <div>
            <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Home City
            </label>
            <input
              type="text"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              maxLength={60}
              placeholder="Where are you based?"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
            />
          </div>

          {/* Pronouns + Website */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Pronouns
              </label>
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                maxLength={30}
                placeholder="they/them, she/her…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={200}
                placeholder="https://…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Personal info — used to auto-fill checkout */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="font-dm-mono text-xs uppercase tracking-[0.2em] text-[#3AFFD4]">
              Personal Info
            </p>
            <p className="mt-1 mb-4 text-xs text-neutral-500">
              Private — never shown publicly. Used to auto-fill your name, phone &amp; address at
              checkout (FestDash orders, Shop) so you don&apos;t retype it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} type="tel"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Address</label>
                <input value={address1} onChange={(e) => setAddress1(e.target.value)} maxLength={120} placeholder="Street address"
                  className="mb-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
                <input value={address2} onChange={(e) => setAddress2(e.target.value)} maxLength={120} placeholder="Apt, suite, etc. (optional)"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">State</label>
                  <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={40}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">ZIP</label>
                  <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Avatar border */}
          <div>
            <label className="mb-3 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
              Avatar Border
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BORDER_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setAvatarBorder(opt.key)}
                  className="w-full text-left"
                >
                  <BorderPreview
                    borderKey={opt.key}
                    active={avatarBorder === opt.key}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Forum tags — choose which of your earned tags show in the forum */}
          {profile && profileTags(profile).length > 0 && (
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Forum Tags
              </label>
              <p className="mb-3 text-xs text-neutral-600">
                Your tags always show on your profile. Choose which ones also show next to your name in the forum.
              </p>
              <div className="space-y-2">
                {profileTags(profile).map((k: TagKey) => {
                  const t = TAG_CONFIG[k];
                  const shown = !hiddenTags.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() =>
                        setHiddenTags((prev) =>
                          shown ? [...prev, k] : prev.filter((x) => x !== k)
                        )
                      }
                      className="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition"
                      style={{
                        borderColor: shown ? `${t.color}55` : "rgba(255,255,255,0.08)",
                        background: shown ? `${t.color}10` : "transparent",
                      }}
                    >
                      <span className="font-dm-mono text-xs uppercase tracking-widest" style={{ color: t.color }}>
                        {t.glyph} {t.label}
                      </span>
                      <span className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                        {shown ? "Shown in forum ✓" : "Hidden"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}
          {saved && (
            <p className="text-sm text-[#3AFFD4]">Saved! Redirecting…</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || saved}
              className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>

        {userId && profile && profile.is_vendor && (
          <div className="mt-10">
            <ShowsEditor userId={userId} initialHideShows={!!profile.hide_shows} />
          </div>
        )}

        {userId && profile && (
          <ArtisanEditor userId={userId} profile={profile} />
        )}
      </div>
    </main>
  );
}
