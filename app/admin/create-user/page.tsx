"use client";
import { useState } from "react";
import Link from "next/link";

export default function AdminCreateUserPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [forumRole, setForumRole] = useState("merchant");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; userId?: string; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        displayName,
        username,
        vendorId: vendorId ? Number(vendorId) : null,
        forumRole,
      }),
    });

    const json = await res.json();
    setResult(json);
    setLoading(false);

    if (json.success) {
      setEmail("");
      setPassword("");
    }
  }

  return (
    <main className="min-h-screen text-neutral-100">
      <div className="border-b border-white/10 bg-neutral-950/90">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/admin" className="font-dm-mono text-xs text-neutral-600 hover:text-neutral-400">
            ← Admin
          </Link>
          <h1 className="mt-2 font-bebas text-4xl tracking-wide">Create User Account</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Creates a confirmed Supabase auth account plus both profile rows.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="brandimartenas@gmail.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Temporary Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a temp password"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Brandi Martenas"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="brandi_homesteadlife"
                pattern="[a-zA-Z0-9_]{2,20}"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Vendor ID
                <span className="ml-1 normal-case tracking-normal text-neutral-700">(from vendors table — leave blank for non-vendor)</span>
              </label>
              <input
                type="number"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                placeholder="e.g. 6"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3AFFD4]/40 focus:outline-none"
              />
              <p className="mt-1 font-dm-mono text-[10px] text-neutral-600">
                Find it: Supabase → Table Editor → vendors → look up the ID for the vendor name
              </p>
            </div>

            <div>
              <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Forum Role
              </label>
              <select
                value={forumRole}
                onChange={(e) => setForumRole(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 focus:outline-none"
              >
                {["drifter", "wanderer", "merchant", "warden", "archon"].map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {result && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                result.success
                  ? "border-[#3AFFD4]/20 bg-[#3AFFD4]/5 text-[#3AFFD4]"
                  : "border-[#FF5C3A]/20 bg-[#FF5C3A]/5 text-[#FF5C3A]"
              }`}
            >
              {result.success
                ? `✓ Account created — user ID: ${result.userId}`
                : `✗ ${result.error}`}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#39FF14] px-6 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
            <p className="text-xs text-neutral-600">
              Account is created as confirmed — no email verification required.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
