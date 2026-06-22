"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RankBadge } from "@/app/components/RankBadge";
import Link from "next/link";

type AdminUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
  created_at: string;
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
                          <RankBadge role={u.role} name={u.display_name} />
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
                    </td>
                    <td className="px-5 py-4 text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
