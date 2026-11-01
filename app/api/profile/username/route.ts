import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { usernameProblem } from "@/utils/username";

// Username check + choice for the signed-in user. Writes go through the user's
// own session (RLS "own update profile"); username_chosen_at marks that the
// person picked or kept their name, which is what stops the prompt.

async function takenByAnother(supabase: Awaited<ReturnType<typeof createClient>>, username: string, me: string) {
  const { data } = await supabase.from("user_profiles").select("id").ilike("username", username).neq("id", me).limit(1).maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = new URL(req.url).searchParams.get("u")?.trim() ?? "";
  const problem = usernameProblem(u);
  if (problem) return NextResponse.json({ ok: false, problem });
  if (await takenByAnother(supabase, u, user.id)) return NextResponse.json({ ok: false, problem: "That username is taken. Try another." });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  // "Keep what I have": only stamps the choice.
  if (body.keep === true) {
    const { data: me } = await supabase.from("user_profiles").select("username").eq("id", user.id).maybeSingle();
    if (!me?.username) return NextResponse.json({ error: "You don't have a username yet — choose one." }, { status: 400 });
    const { error } = await supabase.from("user_profiles").update({ username_chosen_at: now }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ username: me.username });
  }

  const username = String(body.username ?? "").trim();
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (await takenByAnother(supabase, username, user.id)) {
    return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });
  }
  const { error } = await supabase.from("user_profiles").update({ username, username_chosen_at: now }).eq("id", user.id);
  if (error) {
    // 23505: claimed between the check and the write.
    const taken = error.code === "23505";
    return NextResponse.json({ error: taken ? "That username was just taken. Try another." : error.message }, { status: taken ? 409 : 500 });
  }
  return NextResponse.json({ username });
}
