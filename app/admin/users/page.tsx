"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RankBadge } from "@/app/components/RankBadge";
import Link from "next/link";
import { UsernameNudge } from "./UsernameNudge";
import { MEMBER_TAGS, TAG_CONFIG, type MemberTag } from "@/app/components/roleColors";
import { SITE_RANKS, RANK_INFO, isSiteRank, type SiteRank } from "@/utils/ranks";

type AdminUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
  username?: string | null;
  created_at: string;
  is_founder?: boolean;
  is_vendor?: boolean;
  is_marketplace?: boolean;
  is_festdash_vendor?: boolean;
  is_promoter?: boolean;
  is_artisan?: boolean;
  is_driver?: boolean;
  is_forager?: boolean;
  extra_ranks?: string[] | null;
  is_site_moderator?: boolean;
  vendor_id?: number | null;
  shop?: Shop | null;
};
type Shop = { id: number; name: string | null; status: string | null; is_public: boolean | null; suspended_at: string | null; suspended_reason: string | null; items: number; on_sale: number };

/** Does this person hold the tag? (utils/memberTags.ts decides how each is stored.) */
function holds(u: AdminUser, t: MemberTag): boolean {
  switch (t) {
    case "merchant": return !!u.is_marketplace || !!u.extra_ranks?.includes("merchant");
    case "promoter": return !!u.is_promoter || !!u.extra_ranks?.includes("promoter");
    case "festdash_vendor": return !!u.is_festdash_vendor;
    case "vendor": return !!u.is_vendor;
    case "driver": return !!u.is_driver;
    case "artisan": return !!u.is_artisan;
    case "forager": return !!u.is_forager;
    case "founder": return !!u.is_founder;
  }
}
const FIELD_OF: Record<MemberTag, keyof AdminUser> = {
  merchant: "is_marketplace", promoter: "is_promoter", festdash_vendor: "is_festdash_vendor", vendor: "is_vendor",
  driver: "is_driver", artisan: "is_artisan", forager: "is_forager", founder: "is_founder",
};
/** Public = approved, listed, and not switched off (lights out). */
function shopState(shop: Shop): "public" | "hidden" | "unlisted" {
  if (shop.suspended_at) return "hidden";
  return shop.status === "approved" && shop.is_public ? "public" : "unlisted";
}

type UserDetails = {
  account: { email: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null; created_at: string | null; providers: string[]; auth_phone: string | null };
  profile: Record<string, string | boolean | null>;
  vendor: { id: number; name: string | null; status: string | null } | null;
  promoter: { referral_code: string | null; is_active: boolean; is_coordinator: boolean; region: string | null; payout_method: string | null } | null;
};
type EditKey = "display_name" | "username" | "home_city" | "pronouns" | "website" | "bio" | "email" | "full_name" | "phone" | "address_line1" | "address_line2" | "city" | "region" | "postal_code";
const EMPTY_FORM: Record<EditKey, string> = { display_name: "", username: "", home_city: "", pronouns: "", website: "", bio: "", email: "", full_name: "", phone: "", address_line1: "", address_line2: "", city: "", region: "", postal_code: "" };

function whenish(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function memberSince(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<"all" | MemberTag | "shop">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<Record<EditKey, string>>(EMPTY_FORM);
  const [editDetails, setEditDetails] = useState<UserDetails | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/get-users");
    if (res.status === 401 || res.status === 403) {
      router.push("/");
      return;
    }
    const json = await res.json();
    setUsers(json.users ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (p?.role !== "archon" && p?.role !== "warden") {
        router.push("/");
        return;
      }
      setMyRole(p.role);
      setMyId(user.id);
      fetchUsers();
    });
  }, [router, fetchUsers]);

  // Derived, not stored: the list follows search, filters and edits on its own.
  const filteredUsers = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.username ?? "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (tagFilter === "shop") result = result.filter((u) => !!u.shop);
    else if (tagFilter !== "all") result = result.filter((u) => holds(u, tagFilter));
    return result;
  }, [search, roleFilter, tagFilter, users]);

  async function updateRole(targetId: string, newRole: string) {
    setSavingId(targetId);
    setError("");
    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: targetId, newRole }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to update role");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === targetId ? { ...u, role: newRole } : u))
    );
  }

  // Give / take one tag (utils/memberTags.ts, saved as you tap).
  async function setTag(target: AdminUser, tag: MemberTag, value: boolean) {
    setSavingId(target.id); setError(""); setEditMsg("");
    const res = await fetch("/api/admin/user-tags", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: target.id, tag, value }),
    });
    const j = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) { (editing ? setEditMsg : setError)(j.error || "Couldn't change that tag."); return; }
    const extras = (target.extra_ranks ?? []).filter((r) => r !== tag);
    const patch: Partial<AdminUser> = { [FIELD_OF[tag]]: value };
    if (tag === "merchant" || tag === "promoter") patch.extra_ranks = value ? [...extras, tag] : extras;
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, ...patch } : u)));
    if (editing?.id === target.id) setEditing({ ...editing, ...patch });
    if (tag === "promoter") {
      setEditDetails((d) => d ? { ...d, promoter: value ? { referral_code: j.referral_code ?? d.promoter?.referral_code ?? null, is_active: true, is_coordinator: d.promoter?.is_coordinator ?? false, region: d.promoter?.region ?? null, payout_method: d.promoter?.payout_method ?? null } : d.promoter ? { ...d.promoter, is_active: false } : null } : d);
      setEditMsg(value ? `Promoter given${j.referral_code ? ` — their code is ${j.referral_code}` : ""}.` : "Promoter paused. Their code is kept.");
    }
  }

  // Public shop on/off: the same switch as Vendors → Suspend / Restore ("lights
  // out"). Only vendors.suspended_at changes — never their items, prices, sizes
  // or which ones are on sale, so switching back restores the shop exactly.
  async function setShopVisible(target: AdminUser, visible: boolean) {
    if (!target.shop) return;
    setSavingId(target.id); setError("");
    const res = await fetch("/api/vendors/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: target.shop.id, action: visible ? "unsuspend" : "suspend", reason: "Hidden by admin" }),
    });
    const j = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok || j.success === false) { (editing ? setEditMsg : setError)(j.error || "Couldn't change the shop."); return; }
    const shop: Shop = { ...target.shop, suspended_at: visible ? null : new Date().toISOString(), suspended_reason: visible ? null : "Hidden by admin" };
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, shop } : u)));
    if (editing?.id === target.id) setEditing({ ...editing, shop });
  }

  async function openEdit(u: AdminUser) {
    setEditMsg("");
    setEditDetails(null);
    setEditForm({ ...EMPTY_FORM, display_name: u.display_name || "", email: u.email || "" });
    setEditing(u);
    // Everything about the account in one read — including the private personal
    // details from signup, which an admin's own session is not allowed to select.
    const res = await fetch("/api/admin/user-details?id=" + u.id);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setEditMsg(j.error || "Couldn't load this account."); return; }
    const d = j as UserDetails;
    const pr = d.profile as Record<string, string | null>;
    setEditDetails(d);
    setEditForm({
      display_name: pr.display_name || u.display_name || "",
      username: pr.username || "",
      home_city: pr.home_city || "",
      pronouns: pr.pronouns || "",
      website: pr.website || "",
      bio: pr.bio || "",
      email: d.account.email || u.email || "",
      full_name: pr.full_name || "",
      phone: pr.phone || "",
      address_line1: pr.address_line1 || "",
      address_line2: pr.address_line2 || "",
      city: pr.city || "",
      region: pr.region || "",
      postal_code: pr.postal_code || "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setEditMsg("");
    const emailChanged =
      editForm.email.trim().toLowerCase() !== (editing.email || "").toLowerCase();
    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editing.id,
        patch: {
          display_name: editForm.display_name.trim(),
          username: editForm.username.trim(),
          home_city: editForm.home_city.trim(),
          pronouns: editForm.pronouns.trim() || null,
          website: editForm.website.trim() || null,
          bio: editForm.bio,
          full_name: editForm.full_name.trim() || null,
          phone: editForm.phone.trim() || null,
          address_line1: editForm.address_line1.trim() || null,
          address_line2: editForm.address_line2.trim() || null,
          city: editForm.city.trim() || null,
          region: editForm.region.trim() || null,
          postal_code: editForm.postal_code.trim() || null,
        },
        newEmail: emailChanged ? editForm.email.trim() : undefined,
      }),
    });
    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditMsg(json.error ?? "Failed to save.");
      return;
    }
    setUsers((prev) =>
      prev.map((x) =>
        x.id === editing.id
          ? { ...x, display_name: editForm.display_name.trim(), username: editForm.username.trim() || x.username }
          : x
      )
    );
    if (json.emailPending) {
      setEditMsg(
        "Saved. A verification email was sent to the new address — the email changes once they confirm it."
      );
    } else {
      setEditing(null);
    }
  }

  async function deleteUser(target: AdminUser) {
    if (
      !window.confirm(
        `Permanently delete ${target.display_name || target.email}? This removes their account and profile, and frees their email for a fresh signup. This can't be undone.`
      )
    )
      return;
    setDeletingId(target.id);
    setError("");
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: target.id }),
    });
    const json = await res.json().catch(() => ({}));
    setDeletingId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to delete user");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center admin-surface">
        <p className="font-dm-mono text-sm text-neutral-500">Loading users…</p>
      </main>
    );
  }

  const availableRoles: readonly SiteRank[] = myRole === "archon" ? SITE_RANKS : SITE_RANKS.filter((r) => r !== "archon");
  const rankLabel = (r: string) => (isSiteRank(r) ? RANK_INFO[r].label : r.charAt(0).toUpperCase() + r.slice(1));

  return (
    <main className="min-h-screen text-neutral-100 admin-surface">
      <div className="border-b border-white/10 bg-neutral-950/90">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400">
              ← Admin
            </Link>
            <span className="text-neutral-800">|</span>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-[#FF5C3A]">
              User Management
            </p>
          </div>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">All Users</h1>
          <UsernameNudge />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-xl border border-[#FF5C3A]/20 bg-[#FF5C3A]/5 px-4 py-3 text-sm text-[#FF5C3A]">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, @username or email…"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by rank"
            className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none">
            <option value="all">All ranks</option>
            {SITE_RANKS.map((r) => <option key={r} value={r}>{RANK_INFO[r].label} · {RANK_INFO[r].meaning}</option>)}
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value as typeof tagFilter)} aria-label="Filter by tag"
            className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:outline-none">
            <option value="all">All tags</option>
            {MEMBER_TAGS.map((t) => <option key={t.key} value={t.key}>{TAG_CONFIG[t.tag].label}</option>)}
            <option value="shop">Has a shop</option>
          </select>
        </div>

        <p className="mb-4 font-dm-mono text-xs text-neutral-600">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </p>

        {/* One card per person: who they are, their RANK (one), their TAGS
            (any number), and their public shop switch. Full editing in Edit. */}
        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const ini = (u.display_name || u.email).slice(0, 2).toUpperCase() || "??";
            const busy = savingId === u.id;
            const heldTags = MEMBER_TAGS.filter((t) => holds(u, t.key));
            return (
              <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">{ini}</div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${u.id}`} className="hover:underline">
                      <RankBadge role={u.role} name={u.display_name || u.email} tags={[]} />
                    </Link>
                    <p className="mt-0.5 break-all font-dm-mono text-[11px] text-neutral-500">
                      {u.username ? `@${u.username} · ` : ""}{u.email} · joined {memberSince(u.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => openEdit(u)}
                      className="rounded-lg border border-[#3AFFD4]/30 px-3 py-1.5 font-dm-mono text-xs text-[#3AFFD4] transition hover:bg-[#3AFFD4]/10">Edit</button>
                    {u.id === myId ? (
                      <span className="font-dm-mono text-[10px] text-neutral-700">you</span>
                    ) : (
                      <button onClick={() => deleteUser(u)} disabled={deletingId === u.id}
                        className="rounded-lg border border-[#FF5C3A]/30 px-3 py-1.5 font-dm-mono text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10 disabled:opacity-50">
                        {deletingId === u.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <div>
                    <p className="mb-1 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Rank</p>
                    <select value={isSiteRank(u.role) ? u.role : ""} onChange={(e) => updateRole(u.id, e.target.value)}
                      disabled={busy || (myRole !== "archon" && u.role === "archon")} aria-label={`Rank for ${u.display_name || u.email}`}
                      className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 focus:outline-none disabled:opacity-50">
                      {!isSiteRank(u.role) && <option value="" disabled>{rankLabel(u.role)} (old rank)</option>}
                      {(u.role === "archon" ? SITE_RANKS : availableRoles).map((r) => (
                        <option key={r} value={r}>{RANK_INFO[r].label} · {RANK_INFO[r].meaning}</option>
                      ))}
                    </select>
                    {u.is_site_moderator && <p className="mt-1 font-dm-mono text-[10px] text-[#FF9A3C]">+ can give Merchant / Promoter</p>}
                  </div>
                  <div>
                    <p className="mb-1 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {heldTags.length === 0 && <span className="font-dm-mono text-[11px] text-neutral-700">none — add in Edit</span>}
                      {heldTags.map((t) => {
                        const c = TAG_CONFIG[t.tag];
                        return (
                          <span key={t.key} className="rounded-md border px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest"
                            style={{ color: c.color, borderColor: `${c.color}55`, background: `${c.color}14` }}>{c.glyph} {c.label}</span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {u.shop && <ShopSwitch shop={u.shop} busy={busy} onChange={(v) => setShopVisible(u, v)} />}
                {busy && <p className="mt-2 font-dm-mono text-[10px] text-neutral-600">saving…</p>}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
          onClick={() => !editSaving && setEditing(null)}
        >
          <div
            className="my-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wide">Edit account</h2>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg px-2 text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {(() => {
              const label = "mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500";
              const input = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 focus:outline-none";
              const section = "font-dm-mono text-[10px] uppercase tracking-[0.2em] text-[#3AFFD4]/80";
              const field = (key: EditKey, text: string, type = "text") => (
                <div key={key}>
                  <label className={label}>{text}</label>
                  <input type={type} value={editForm[key]} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} className={input} />
                </div>
              );
              const a = editDetails?.account;
              const facts: [string, string][] = [
                ["Confirmed", whenish(a?.email_confirmed_at) ?? (editDetails ? "not yet" : "…")],
                ["Signs in with", a ? (a.providers.length ? a.providers.join(", ") : "email") : "…"],
                ["Last sign-in", a ? whenish(a.last_sign_in_at) ?? "never" : "…"],
                ["Joined", whenish(a?.created_at ?? editing.created_at) ?? "—"],
                ["Vendor", editDetails?.vendor ? `${editDetails.vendor.name ?? "Vendor"} · #${editDetails.vendor.id} · ${editDetails.vendor.status ?? ""}` : "—"],
                ["Promoter code", editDetails?.promoter?.referral_code ? `${editDetails.promoter.referral_code}${editDetails.promoter.is_active ? "" : " (paused)"}${editDetails.promoter.is_coordinator ? " · coordinator" : ""}` : "—"],
              ];
              if (typeof editDetails?.profile.pending_email === "string" && editDetails.profile.pending_email) facts.push(["Pending email", editDetails.profile.pending_email]);
              return (
                <div className="space-y-5">
                  <section className="space-y-3">
                    <p className={section}>Account</p>
                    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-xs">
                      {facts.map(([k, v]) => (<div key={k} className="contents"><dt className="text-neutral-600">{k}</dt><dd className="min-w-0 break-words text-neutral-300">{v}</dd></div>))}
                    </dl>
                    <div>
                      <label className={label}>Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={input} />
                      <p className="mt-1 font-dm-mono text-[10px] text-neutral-600">Changing the email sends a verification link to the new address — it only switches once they confirm.</p>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={section}>Identity</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {field("display_name", "Display name")}
                      {field("username", "Username")}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={section}>Personal details (from signup)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {field("full_name", "Full name")}
                      {field("phone", "Phone", "tel")}
                      {field("address_line1", "Address line 1")}
                      {field("address_line2", "Address line 2")}
                      {field("city", "City")}
                      {field("region", "State / region")}
                      {field("postal_code", "Postal code")}
                    </div>
                    <p className="font-dm-mono text-[10px] text-neutral-600">Private to the person and to admins. Never shown on a public profile.</p>
                  </section>

                  <section className="space-y-3">
                    <p className={section}>Public profile</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {field("home_city", "Home city")}
                      {field("pronouns", "Pronouns")}
                    </div>
                    {field("website", "Website", "url")}
                    <div>
                      <label className={label}>Bio</label>
                      <textarea value={editForm.bio} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} rows={3} className={input + " resize-none"} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={section}>Rank <span className="normal-case tracking-normal text-neutral-600">— one per person, saved as you tap</span></p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SITE_RANKS.map((r) => {
                        const on = editing.role === r;
                        const locked = myRole !== "archon" && (r === "archon" || editing.role === "archon");
                        return (
                          <button key={r} type="button" disabled={locked || savingId === editing.id}
                            onClick={() => { if (!on) { updateRole(editing.id, r); setEditing({ ...editing, role: r }); } }}
                            className={`rounded-xl border px-3 py-2 text-left transition disabled:opacity-40 ${on ? "border-[#3AFFD4] bg-[#3AFFD4]/10" : "border-white/10 hover:bg-white/5"}`}>
                            <span className={`block text-sm font-semibold ${on ? "text-[#3AFFD4]" : "text-neutral-200"}`}>{RANK_INFO[r].label}{on ? " ✓" : ""}</span>
                            <span className="block font-dm-mono text-[10px] text-neutral-500">{RANK_INFO[r].meaning}</span>
                          </button>
                        );
                      })}
                    </div>
                    {editing.is_site_moderator && <p className="font-dm-mono text-[10px] text-[#FF9A3C]">Also a site moderator: can give Merchant / Promoter tags (switch on their profile page).</p>}
                  </section>

                  <section className="space-y-3">
                    <p className={section}>Tags <span className="normal-case tracking-normal text-neutral-600">— any number, saved as you tap</span></p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {MEMBER_TAGS.map((t) => {
                        const on = holds(editing, t.key);
                        const c = TAG_CONFIG[t.tag];
                        return (
                          <button key={t.key} type="button" disabled={savingId === editing.id} onClick={() => setTag(editing, t.key, !on)}
                            className="rounded-xl border px-3 py-2 text-left transition hover:bg-white/5 disabled:opacity-50"
                            style={on ? { borderColor: `${c.color}88`, background: `${c.color}14` } : { borderColor: "rgba(255,255,255,0.1)" }}>
                            <span className="block font-dm-mono text-[11px] uppercase tracking-widest" style={{ color: on ? c.color : "#8a8a8a" }}>
                              {on ? "✓" : "+"} {c.glyph} {c.label}
                            </span>
                            <span className="block text-[11px] text-neutral-500">{t.help}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {editing.shop && (
                    <section className="space-y-2">
                      <p className={section}>Public shop</p>
                      <ShopSwitch shop={editing.shop} busy={savingId === editing.id} onChange={(v) => setShopVisible(editing, v)} />
                    </section>
                  )}
                </div>
              );
            })()}

            {editMsg && <p className="mt-4 text-sm text-[#3AFFD4]">{editMsg}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-400 transition hover:text-white"
              >
                Close
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * The public-shop switch (owner, 2026-11-05). Merchant lets someone build a
 * shop; this decides whether the public sees it. Off = lights out
 * (vendors.suspended_at): nothing about their items changes, so On puts the
 * shop back exactly as it was. A shop that was never approved or listed is
 * set up in Vendors first.
 */
function ShopSwitch({ shop, busy, onChange }: { shop: Shop; busy: boolean; onChange: (visible: boolean) => void }) {
  const state = shopState(shop);
  const on = state === "public";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <button type="button" role="switch" aria-checked={on} disabled={busy || state === "unlisted"} onClick={() => onChange(!on)}
        className="rounded-lg border px-3 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest transition disabled:opacity-50"
        style={on ? { color: "#00D4FF", borderColor: "#00D4FF55", background: "#00D4FF14" } : { color: "#9aa", borderColor: "rgba(255,255,255,0.15)" }}>
        ▣ {on ? "Public shop ✓" : state === "hidden" ? "Shop hidden — turn on" : "Not listed"}
      </button>
      <span className="min-w-0 text-[11px] text-neutral-400">
        {shop.name ?? "Shop"} · {shop.items} item{shop.items === 1 ? "" : "s"}, {shop.on_sale} on sale
        {state === "unlisted" ? <> · <Link href="/admin/vendors" className="underline">approve / list it in Vendors</Link></> : " · switching never changes their items"}
      </span>
    </div>
  );
}
