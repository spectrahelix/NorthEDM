"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RankBadge } from "@/app/components/RankBadge";
import { profileTags } from "@/utils/supabase/user-profiles";
import Link from "next/link";
import { UsernameNudge } from "./UsernameNudge";

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
  is_verified?: boolean;
};

// Ranks, in order. "promoter" is a real rank (set when a promoter application is
// approved); it used to be missing from the table's dropdown but present in the
// editor's, so the two disagreed.
const ROLES = ["drifter", "wanderer", "merchant", "promoter", "warden", "archon"] as const;

type UserDetails = {
  account: { email: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null; created_at: string | null; providers: string[]; auth_phone: string | null };
  profile: Record<string, string | boolean | null>;
  vendor: { id: number; name: string | null; status: string | null } | null;
  promoter: { referral_code: string | null; is_active: boolean; is_coordinator: boolean; region: string | null; payout_method: string | null } | null;
};
type EditKey = "display_name" | "username" | "role" | "home_city" | "pronouns" | "website" | "bio" | "email" | "full_name" | "phone" | "address_line1" | "address_line2" | "city" | "region" | "postal_code";
const EMPTY_FORM: Record<EditKey, string> = { display_name: "", username: "", role: "drifter", home_city: "", pronouns: "", website: "", bio: "", email: "", full_name: "", phone: "", address_line1: "", address_line2: "", city: "", region: "", postal_code: "" };
type TagFlag = "is_verified" | "is_driver" | "is_forager" | "is_artisan" | "is_promoter" | "is_founder" | "is_marketplace";

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
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
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
    setFilteredUsers(json.users ?? []);
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

  useEffect(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    setFilteredUsers(result);
  }, [search, roleFilter, users]);

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

  async function toggleFounder(target: AdminUser) {
    setSavingId(target.id);
    setError("");
    const value = !target.is_founder;
    const res = await fetch("/api/admin/user-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: target.id, flag: "is_founder", value }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to update Founder tag");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, is_founder: value } : u))
    );
  }

  async function toggleEditingTag(flag: TagFlag) {
    if (!editing) return;
    const value = !editing[flag];
    const res = await fetch("/api/admin/user-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: editing.id, flag, value }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setEditMsg(j.error || "Failed"); return; }
    setEditing({ ...editing, [flag]: value });
    setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, [flag]: value } : u)));
    if (flag === "is_promoter") {
      // Granting Promoter also creates their promoter record and referral code.
      setEditDetails((d) => d ? { ...d, promoter: value ? { referral_code: j.referral_code ?? d.promoter?.referral_code ?? null, is_active: true, is_coordinator: d.promoter?.is_coordinator ?? false, region: d.promoter?.region ?? null, payout_method: d.promoter?.payout_method ?? null } : d.promoter ? { ...d.promoter, is_active: false } : null } : d);
      setEditMsg(value ? `Promoter granted${j.referral_code ? ` — their code is ${j.referral_code}` : ""}.` : "Promoter paused. Their code is kept.");
    }
  }

  async function openEdit(u: AdminUser) {
    setEditMsg("");
    setEditDetails(null);
    setEditForm({ ...EMPTY_FORM, display_name: u.display_name || "", role: u.role, email: u.email || "" });
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
      role: (pr.role as string) || u.role,
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
          role: editForm.role,
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
          ? { ...x, display_name: editForm.display_name.trim(), role: editForm.role, username: editForm.username.trim() || x.username }
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

  async function toggleTag(target: AdminUser, flag: "is_founder" | "is_marketplace") {
    setSavingId(target.id);
    setError("");
    const value = !target[flag];
    const res = await fetch("/api/admin/user-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: target.id, flag, value }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setError(json.error ?? "Failed to update tag");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, [flag]: value } : u)));
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

  const availableRoles = myRole === "archon" ? ROLES : ROLES.filter((r) => r !== "archon");

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
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 focus:outline-none"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-4 font-dm-mono text-xs text-neutral-600">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </p>

        {/* Table */}
        {/* overflow-x-auto, not hidden: on a phone the Actions column was clipped
            off the right edge with no way to reach Edit or Delete. */}
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-5 py-3 text-left font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  User
                </th>
                <th className="px-5 py-3 text-left font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Email
                </th>
                <th className="px-5 py-3 text-left font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Joined
                </th>
                <th className="px-5 py-3 text-left font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Role
                </th>
                <th className="px-5 py-3 text-right font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => {
                const ini = u.display_name.slice(0, 2).toUpperCase() || "??";
                return (
                  <tr key={u.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-dm-mono text-xs text-neutral-400">
                          {ini}
                        </div>
                        <Link
                          href={`/profile/${u.id}`}
                          className="hover:underline"
                        >
                          <RankBadge role={u.role} name={u.display_name} tags={profileTags(u)} />
                        </Link>
                        {u.username && <span className="font-dm-mono text-[10px] text-neutral-600">@{u.username}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-dm-mono text-xs text-neutral-500">
                      {u.email}
                    </td>
                    <td className="px-5 py-4 font-dm-mono text-xs text-neutral-600">
                      {memberSince(u.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        disabled={savingId === u.id}
                        className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 focus:outline-none disabled:opacity-50"
                      >
                        {availableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                      {savingId === u.id && (
                        <span className="ml-2 font-dm-mono text-[10px] text-neutral-600">
                          saving…
                        </span>
                      )}
                      {/* Founder is a vendor-only tag */}
                      {u.is_vendor && (
                        <button
                          onClick={() => toggleFounder(u)}
                          disabled={savingId === u.id}
                          className="ml-2 rounded-lg border px-2.5 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest transition disabled:opacity-50"
                          style={
                            u.is_founder
                              ? { color: "#CC00FF", borderColor: "#CC00FF55", background: "#CC00FF14" }
                              : { color: "#9aa", borderColor: "rgba(255,255,255,0.12)" }
                          }
                          title={u.is_founder ? "Revoke Founder" : "Grant Founder"}
                        >
                          ♛ {u.is_founder ? "Founder ✓" : "Founder"}
                        </button>
                      )}
                      {u.is_vendor && (
                        <button
                          onClick={() => toggleTag(u, "is_marketplace")}
                          disabled={savingId === u.id}
                          className="ml-2 rounded-lg border px-2.5 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest transition disabled:opacity-50"
                          style={
                            u.is_marketplace
                              ? { color: "#00D4FF", borderColor: "#00D4FF55", background: "#00D4FF14" }
                              : { color: "#9aa", borderColor: "rgba(255,255,255,0.12)" }
                          }
                          title={u.is_marketplace ? "Revoke Marketplace access" : "Grant Marketplace access (paid)"}
                        >
                          ▣ {u.is_marketplace ? "Marketplace ✓" : "Marketplace"}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded-lg border border-[#3AFFD4]/30 px-3 py-1.5 font-dm-mono text-xs text-[#3AFFD4] transition hover:bg-[#3AFFD4]/10"
                        >
                          Edit
                        </button>
                        {u.id === myId ? (
                          <span className="font-dm-mono text-[10px] text-neutral-700">you</span>
                        ) : (
                          <button
                            onClick={() => deleteUser(u)}
                            disabled={deletingId === u.id}
                            className="rounded-lg border border-[#FF5C3A]/30 px-3 py-1.5 font-dm-mono text-xs text-[#FF5C3A] transition hover:bg-[#FF5C3A]/10 disabled:opacity-50"
                          >
                            {deletingId === u.id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              const tags: [TagFlag, string][] = [
                ["is_verified", "✔ Verified"],
                ["is_driver", "⬗ Driver"],
                ["is_forager", "❦ Forager"],
                ["is_artisan", "◈ Artisan"],
                ["is_promoter", "✦ Promoter"],
                ...(editing.is_vendor ? ([["is_founder", "♛ Founder"], ["is_marketplace", "▣ Marketplace"]] as [TagFlag, string][]) : []),
              ];
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
                    <p className={section}>Rank &amp; tags</p>
                    <div>
                      <label className={label}>Rank</label>
                      <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none">
                        {availableRoles.map((r) => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>Tags (saved as you tap)</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(([flag, text]) => (
                          <button key={flag} type="button" onClick={() => toggleEditingTag(flag)}
                            className={`rounded-lg border px-3 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest transition ${editing[flag] ? "border-[#3AFFD4] bg-[#3AFFD4]/10 text-[#3AFFD4]" : "border-white/12 text-neutral-400 hover:bg-white/5"}`}>
                            {text} {editing[flag] ? "✓" : ""}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 font-dm-mono text-[10px] text-neutral-600">Promoter creates their promoter record and referral code; Founder and Marketplace apply to vendor accounts.</p>
                    </div>
                  </section>
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
