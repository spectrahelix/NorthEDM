import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({});

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const like = `%${q}%`;

  const [
    { data: vendors },
    { data: festivals },
    { data: products },
    threadsResult,
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, category")
      .or(`name.ilike.${like},description.ilike.${like}`)
      .limit(5),
    supabase
      .from("festival_events")
      .select("id, name, location")
      .or(`name.ilike.${like},location.ilike.${like}`)
      .limit(5),
    supabase
      .from("products")
      .select("id, name, category")
      .ilike("name", like)
      .limit(5),
    user
      ? supabase
          .from("threads")
          .select("id, title, category")
          .or(`title.ilike.${like},body.ilike.${like}`)
          .limit(5)
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    vendors: vendors ?? [],
    festivals: festivals ?? [],
    products: products ?? [],
    // null means "not logged in" — distinct from empty array (logged in, no results)
    threads: user ? (threadsResult.data ?? []) : null,
  });
}
