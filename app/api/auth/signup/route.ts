import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { notifyFeedback } from "@/utils/alerts";
import { sendAuthEmail, authEmailConfigured, authConfirmUrl } from "@/utils/authEmail";
import { humaniseAuthError } from "@/utils/authErrors";
import { firstPasswordProblem } from "@/utils/passwordRules";
import { safeNext, safeOrigin } from "@/utils/safeRedirect";
import { suggestUsername, usernameProblem } from "@/utils/username";
import {
  clientIp,
  clientContradictsItself,
  implausibleGmailDots,
  overRateLimit,
  recordAttempt,
} from "@/utils/botSignals";


export async function POST(req: NextRequest) {
  const { email, password, username: typedUsername, origin: rawOrigin, referralCode, website, elapsedMs, next: rawNext } =
    (await req.json()) as {
      email: string;
      password: string;
      username?: string;
      origin: string;
      next?: string;
      referralCode?: string;
      website?: string;
      elapsedMs?: number;
    };

  // Honeypot: a field positioned off-screen, hidden from people but present in
  // the DOM. Report success so the caller learns nothing and does not retry,
  // but create nothing.
  if (String(website || "").trim()) {
    return NextResponse.json({ success: true });
  }

  // Time on page. Crawlers were posting here within a second or two of load —
  // one created an account at 22:55:47 having opened the page the same second.
  // Nobody reads a signup form, picks a username and types a password twice in
  // under three seconds. An absent or non-numeric value never rejects.
  if (typeof elapsedMs === "number" && elapsedMs >= 0 && elapsedMs < 3000) {
    return NextResponse.json(
      { error: "That was submitted faster than the form could be filled in. Please try again." },
      { status: 400 }
    );
  }

  // Links we email must point at us (safeOrigin) and land on a same-site
  // path (safeNext) — a shop owner arriving from a QR code returns to the
  // walkthrough; everyone else starts at profile setup.
  const origin = safeOrigin(rawOrigin, req.url);
  const next = safeNext(typeof rawNext === "string" ? rawNext : null, "/profile/edit");

  if (!email || !password || !rawOrigin) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  // The username is optional (owner, 2026-11-05): left blank, it defaults to
  // the start of the email address (suggestUsername), made unique below. A
  // typed one must pass the one username rule.
  const typed = String(typedUsername ?? "").trim();
  if (typed) {
    const usernameIssue = usernameProblem(typed);
    if (usernameIssue) return NextResponse.json({ error: usernameIssue }, { status: 400 });
  }
  // Mirror of the rules the signup form shows live, so a request that skips the
  // form gets the same answer. Supabase is still the authority — anything this
  // misses comes back from it and is passed through by humaniseAuthError.
  const passwordProblem = firstPasswordProblem(String(password));
  if (passwordProblem) {
    return NextResponse.json({ error: passwordProblem }, { status: 400 });
  }

  // Signup had no throttle at all, which is how two crawler accounts were
  // created on 2026-09-21. Three an hour from one address is generous for a
  // person (a typo, a retry, a partner on the same wifi) and useless to a
  // script working through a list. Fails open if the counter is unreachable —
  // signup breaking is far worse than a bot getting through.
  const ip = clientIp(req.headers);
  if (await overRateLimit("signup", ip, { max: 3, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: "Too many signup attempts from this connection. Please try again in a little while." },
      { status: 429 }
    );
  }

  // Dot-aliased Gmail. Gmail ignores dots, so i.seul.t.l.anaux@gmail.com and
  // iseultlanaux@gmail.com are one inbox — the cheapest way to mint unlimited
  // accounts from a single mailbox, and exactly what created the 22:55 account.
  // Unlike on sign-in help, this rejects: here the cost of being wrong is one
  // retry with the dots removed, which reaches the same inbox, and the message
  // says so.
  if (implausibleGmailDots(email)) {
    return NextResponse.json(
      {
        error:
          "Please enter your Gmail address without the extra dots — Gmail ignores them, so it reaches the same inbox either way.",
      },
      { status: 400 }
    );
  }

  // A user-agent claiming Chromium with no sec-ch-ua header is a client lying
  // about what it is. Real Chrome cannot omit that header on a secure origin.
  if (clientContradictsItself(req.headers)) {
    await alertSignupFailure(email, "blocked: user-agent claims Chromium but sent no sec-ch-ua");
    return NextResponse.json(
      { error: "We couldn't verify your browser. Please try a different browser, or use “Trouble signing in?” on the login page." },
      { status: 400 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ilike, not eq: uniqueness is enforced case-insensitively
  // (user_profiles_username_uidx on lower(username)), so a case-sensitive check
  // would pass "CJBlue" against an existing "cjblue" and then fail on insert.
  const taken = async (name: string) =>
    !!(await admin.from("user_profiles").select("id").ilike("username", name).maybeSingle()).data;
  let username = typed;
  if (typed) {
    if (await taken(typed)) return NextResponse.json({ error: "That username is taken. Try another." }, { status: 409 });
  } else {
    // Default: the email prefix; if it's taken, reserved or too short, add digits.
    const base = (suggestUsername(String(email)) || "member").slice(0, 16);
    username = base;
    for (let i = 0; i < 20 && (usernameProblem(username) || (await taken(username))); i++) {
      username = `${base}${Math.floor(100 + Math.random() * 9900)}`.slice(0, 20);
    }
    if (usernameProblem(username) || (await taken(username))) {
      return NextResponse.json({ error: "Please pick a username." }, { status: 400 });
    }
  }

  const normalizedRef = referralCode ? String(referralCode).trim().toUpperCase() : null;
  const metadata = normalizedRef ? { username, referral_code: normalizedRef } : { username };
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

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
    const tokenHash = link?.properties?.hashed_token;
    if (!user || !tokenHash) {
      await alertSignupFailure(email, "generateLink returned no hashed_token");
      return NextResponse.json(
        { error: "We couldn't start your signup. Please try again in a moment." },
        { status: 500 }
      );
    }

    await seedProfiles(user.id);
    // An account exists now, so this one counts. A rejected signup (weak
    // password, taken username) must not spend the caller's allowance.
    await recordAttempt("signup", ip);

    // Our own /auth/confirm URL, not properties.action_link — see authConfirmUrl.
    // action_link hands back the tokens in the URL fragment, which no server
    // route can read, so confirming would have dumped the new member on /login.
    const sent = await sendAuthEmail(
      email,
      "signup",
      authConfirmUrl({
        origin: String(origin).replace(/\/$/, ""),
        tokenHash,
        type: "signup",
        next,
      })
    );
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
    await recordAttempt("signup", ip);
  }

  return NextResponse.json({ success: true });

  // Closes over `admin` and `username` above — declared here rather than at
  // module scope so it uses the concrete client type instead of a re-declared
  // one whose generics don't match.
  async function seedProfiles(userId: string) {
    await Promise.all([
      admin.from("user_profiles").upsert({ id: userId, username, username_chosen_at: new Date().toISOString() }, { onConflict: "id" }),
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
