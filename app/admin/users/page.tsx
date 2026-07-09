"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RankBadge } from "@/app/components/RankBadge";
import { profileTags } from "@/utils/supabase/user-profiles";
import Link from "next/link";

type AdminUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
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

const ROLES = ["drifter", "wanderer", "merchant", "warden", "archon"] as const;

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
  const [editForm, setEditForm] = useState({
    display_name: "",
    role: "drifter",
    home_city: "",
    pronouns: "",
    website: "",
    bio: "",
    email: "",
  });
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

  async function toggleEditingTag(flag: "is_driver" | "is_forager" | "is_verified" | "is_artisan") {
    if (!editing) return;
    const value = !editing[flag];
    const res = await fetch("/api/admin/user-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: editing.id, flag, value }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setEditMsg(j.error || "Failed"); return; }
    setEditing({ ...editing, [flag]: value });
    setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, [flag]: value } : u)));
  }

  async function openEdit(u: AdminUser) {
    setEditMsg("");
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("home_city, bio, pronouns, website")
      .eq("id", u.id)
      .single();
    setEditForm({
      display_name: u.display_name || "",
      role: u.role,
      home_city: data?.home_city || "",
      pronouns: data?.pronouns || "",
      website: data?.website || "",
      bio: data?.bio || "",
      email: u.email || "",
    });
    setEditing(u);
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
          role: editForm.role,
          home_city: editForm.home_city.trim(),
          pronouns: editForm.pronouns.trim() || null,
          website: editForm.website.trim() || null,
          bio: editForm.bio,
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
          ? { ...x, display_name: editForm.display_name.trim(), role: editForm.role }
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
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
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
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-6"
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

            <div className="space-y-3">
              {(
                [
                  ["display_name", "Display name", "text"],
                  ["home_city", "Home city", "text"],
                  ["pronouns", "Pronouns", "text"],
                  ["website", "Website", "url"],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <label className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                >
                  {[...ROLES, "promoter"].map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                />
                <p className="mt-1 font-dm-mono text-[10px] text-neutral-600">
                  Changing the email sends a verification link to the new address — it only
                  switches once they confirm.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Grantable Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["is_verified", "✔ Verified"],
                    ["is_driver", "⬗ Driver"],
                    ["is_forager", "❦ Forager"],
                    ["is_artisan", "◈ Artisan"],
                  ] as const).map(([flag, label]) => (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => toggleEditingTag(flag)}
                      className={`rounded-lg border px-3 py-1.5 font-dm-mono text-[10px] uppercase tracking-widest transition ${
                        editing[flag]
                          ? "border-[#3AFFD4] bg-[#3AFFD4]/10 text-[#3AFFD4]"
                          : "border-white/12 text-neutral-400 hover:bg-white/5"
                      }`}
                    >
                      {label} {editing[flag] ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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
