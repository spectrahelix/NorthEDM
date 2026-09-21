import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { notifyFeedback } from "@/utils/alerts";
import { sendAuthEmail, authEmailConfigured } from "@/utils/authEmail";
import { humaniseAuthError } from "@/utils/authErrors";

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

export async function POST(req: NextRequest) {
  const { email, password, username, origin, referralCode } = (await req.json()) as {
    email: string;
    password: string;
    username: string;
    origin: string;
    referralCode?: string;
  };

  if (!email || !password || !username || !origin) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid username." }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ilike, not eq: uniqueness is enforced case-insensitively
  // (user_profiles_username_uidx on lower(username)), so a case-sensitive check
  // would pass "CJBlue" against an existing "cjblue" and then fail on insert.
  const { data: existing } = await admin
    .from("user_profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });
  }

  const normalizedRef = referralCode ? String(referralCode).trim().toUpperCase() : null;
  const metadata = normalizedRef ? { username, referral_code: normalizedRef } : { username };
  const redirectTo = `${origin}/auth/callback`;

  // ── Create the account and deliver the confirmation ourselves ─────────────
  //
  // Not supabase.auth.signUp(): that asks Supabase to send the mail over SMTP,
  // and when SMTP fails Supabase creates NO account and returns an error. That
  // is precisely what happened here — the provider rejected Supabase's sending
  // IPs (525 "5.7.1 Unauthorized IP address") and every signup silently wrote
  // nothing for two months.
  //
  // generateLink() mints the same confirmation link and sends NOTHING, so the
  // account exists either way and delivery is ours to control. We send over
  // Brevo's HTTP API, which utils/alerts.ts already proves works from this
  // runtime — it is only the SMTP path that is IP-blocked.
  if (authEmailConfigured()) {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: metadata, redirectTo },
    });

    if (linkError) {
      // Existing address: say nothing that confirms an account exists here.
      if (/already|registered|exists/i.test(linkError.message)) {
        return NextResponse.json({ success: true });
      }
      await alertSignupFailure(email, linkError.message);
      return NextResponse.json({ error: humaniseAuthError(linkError.message) }, { status: 400 });
    }

    const user = link?.user;
    const actionLink = link?.properties?.action_link;
    if (!user || !actionLink) {
      await alertSignupFailure(email, "generateLink returned no action_link");
      return NextResponse.json(
        { error: "We couldn't start your signup. Please try again in a moment." },
        { status: 500 }
      );
    }

    await seedProfiles(user.id);

    const sent = await sendAuthEmail(email, "signup", actionLink);
    if (!sent.ok) {
      // The account exists but the person has no link. Tell them the truth and
      // point at the one door that is open to them.
      await alertSignupFailure(email, `account created but email failed: ${sent.error}`);
      return NextResponse.json(
        {
          error:
            "Your account was created, but we couldn't send the confirmation email. Use “Trouble signing in?” on the login page and we'll sort it out by hand.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  }

  // ── Fallback: let Supabase send (works when its SMTP is healthy) ──────────
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo, data: metadata },
  });

  if (signUpError) {
    await alertSignupFailure(email, signUpError.message);
    return NextResponse.json({ error: humaniseAuthError(signUpError.message) }, { status: 400 });
  }

  // An empty identities array means the address is already registered. Don't
  // leak that — same success shape, and skip seeding so an existing profile is
  // never clobbered.
  const user = signUpData.user;
  if (user && (user.identities?.length ?? 0) > 0) {
    await seedProfiles(user.id);
  }

  return NextResponse.json({ success: true });

  // Closes over `admin` and `username` above — declared here rather than at
  // module scope so it uses the concrete client type instead of a re-declared
  // one whose generics don't match.
  async function seedProfiles(userId: string) {
    await Promise.all([
      admin.from("user_profiles").upsert({ id: userId, username }, { onConflict: "id" }),
      admin.from("user_profiles").upsert({
        id: userId,
        display_name: username,
        role: "drifter",
        bio: "",
        home_city: "",
        avatar_border: "moss",
        avatar_url: null,
      }),
    ]);
  }
}

/**
 * Signup failures are invisible from the outside — the site looks healthy and
 * the visitor simply leaves. Two months of that is what prompted this. Every
 * failure now reaches the owner.
 */
async function alertSignupFailure(email: string, detail: string) {
  console.error("SIGNUP FAILED:", detail);
  await notifyFeedback({
    message:
      `🚨 SIGNUP FAILED — a real visitor could not create an account.\n\n` +
      `Detail: ${detail}\n\n` +
      `Auth email is delivered through the Brevo HTTP API (utils/authEmail.ts), ` +
      `not Supabase SMTP. If this mentions email, check BREVO_API_KEY and that ` +
      `BREVO_SENDER_EMAIL is a verified sender in Brevo.`,
    category: "signup-failure",
    email: String(email),
  }).catch((e) => console.error("signup-failure alert failed:", e));
}
