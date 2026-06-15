import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const { email, origin } = await req.json() as { email: string; origin: string };
  if (!email || !origin) {
    return NextResponse.json({ error: "Missing email or origin." }, { status: 400 });
  }

  // Re-send the native Supabase signup confirmation email.
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
