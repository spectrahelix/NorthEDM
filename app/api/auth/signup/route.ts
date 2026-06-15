import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

export async function POST(req: NextRequest) {
  const { email, password, username, origin } = await req.json() as {
    email: string;
    password: string;
    username: string;
    origin: string;
  };

  if (!email || !password || !username || !origin) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid username." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Check username availability
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });
  }

  // Create the user via Supabase's native sign-up. Supabase sends the
  // confirmation email through its own mail service — no third-party sender,
  // no custom-domain verification needed. The link lands on /auth/callback.
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { username },
    },
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  // An empty identities array means the email is already registered. Don't
  // leak that — return the same success shape as a fresh signup, and skip
  // seeding so we never clobber the existing user's profile.
  const user = signUpData.user;
  const isNewUser = !!user && (user.identities?.length ?? 0) > 0;

  if (user && isNewUser) {
    await Promise.all([
      admin.from("profiles").upsert({ id: user.id, role: "user", username }),
      admin.from("user_profiles").upsert({
        id: user.id,
        display_name: username,
        role: "drifter",
        bio: "",
        home_city: "",
        avatar_border: "moss",
        avatar_url: null,
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
