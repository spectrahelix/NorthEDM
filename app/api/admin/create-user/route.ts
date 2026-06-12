import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "cjblue27@gmail.com";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user?.id ?? "")
      .single();

    const isAdmin =
      profile?.role === "archon" ||
      profile?.role === "warden" ||
      user?.email === ADMIN_EMAIL;

    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, password, displayName, username, vendorId, forumRole } =
      await req.json();

    if (!email || !password || !displayName || !username) {
      return NextResponse.json(
        { error: "email, password, displayName, and username are required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try to create the auth user; if already exists, look up their ID instead
    let uid: string;
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      // User already exists — find their ID via admin user list
      if (createError.message?.toLowerCase().includes("already been registered") ||
          createError.message?.toLowerCase().includes("already exists")) {
        const { data: listData, error: listError } =
          await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (listError || !listData) {
          return NextResponse.json({ error: "User exists but could not retrieve ID" }, { status: 500 });
        }
        const existing = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) {
          return NextResponse.json({ error: "User exists but was not found in user list" }, { status: 500 });
        }
        uid = existing.id;
      } else {
        return NextResponse.json({ error: createError.message ?? "Failed to create user" }, { status: 500 });
      }
    } else if (!newUser.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    } else {
      uid = newUser.user.id;
    }

    // Create both profile rows in parallel
    const [{ error: profileError }, { error: upError }] = await Promise.all([
      adminClient.from("profiles").upsert({
        id: uid,
        role: "vendor",
        username,
        vendor_id: vendorId ?? null,
      }),
      adminClient.from("user_profiles").upsert({
        id: uid,
        display_name: displayName,
        role: forumRole ?? "merchant",
        bio: "",
        home_city: "",
        avatar_border: "moss",
        avatar_url: null,
      }),
    ]);

    if (profileError || upError) {
      return NextResponse.json(
        { error: profileError?.message ?? upError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId: uid });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
