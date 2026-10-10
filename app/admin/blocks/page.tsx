import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { BlocksClient } from "./BlocksClient";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export default async function AdminBlocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).single();
  const isAdmin =
    profile?.role === "archon" || profile?.role === "warden" || user.email === ADMIN_EMAIL;
  if (!isAdmin) redirect("/");

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#FF5C3A]">
          ← Admin
        </Link>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Blocked People</h1>
        <p className="mb-10 mt-2 max-w-2xl text-neutral-400">
          The site slows down anyone hammering a form, to keep bots out. Now and
          then it catches a real person. This is where you let them straight back
          in.
        </p>
        <BlocksClient />
      </div>
    </main>
  );
}
