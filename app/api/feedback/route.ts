import { NextResponse } from "next/server";
import { notifyFeedback } from "@/utils/alerts";

// Receives beta-tester feedback from /feedback and fans it out to the owner
// (email + phone push + in-app). No auth required so testers can submit freely.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  const category = String(body.category || "").trim().slice(0, 40);
  const email = String(body.email || "").trim().slice(0, 200);

  if (message.length < 3) {
    return NextResponse.json({ error: "Please enter a bit more detail." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }

  await notifyFeedback({ message, category, email });
  return NextResponse.json({ ok: true });
}
