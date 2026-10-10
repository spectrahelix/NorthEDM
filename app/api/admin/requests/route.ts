import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";
import { sendEmail } from "@/utils/email";
import { checkWrite } from "@/utils/dbWrite";

// Admin actions on a service request: change its status, or reply to the
// person who sent it. Before this the page was a read-only table — a request
// could be seen but not answered, accepted or turned down.

const STATUSES = ["pending", "accepted", "in_progress", "completed", "declined"] as const;
type Status = (typeof STATUSES)[number];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = (await req.json().catch(() => ({}))) as {
    id?: number;
    action?: "status" | "reply";
    status?: Status;
    message?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Missing request id." }, { status: 400 });

  // ── Status ───────────────────────────────────────────────────────────────
  if (body.action === "status") {
    if (!body.status || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const ok = await checkWrite(
      `request ${body.id} -> ${body.status}`,
      await g.admin
        .from("requests")
        .update({ status: body.status, completed: body.status === "completed" })
        .eq("id", body.id)
    );
    if (!ok) return NextResponse.json({ error: "Couldn't update that request." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Reply ────────────────────────────────────────────────────────────────
  if (body.action === "reply") {
    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
    if (message.length > 5000) {
      return NextResponse.json({ error: "That message is too long (5,000 characters max)." }, { status: 400 });
    }

    const { data: request } = await g.admin
      .from("requests")
      .select("id, name, email, service_type")
      .eq("id", body.id)
      .maybeSingle();
    if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (!request.email) {
      return NextResponse.json({ error: "This request has no email address to reply to." }, { status: 400 });
    }

    // Replies go to whoever is answering, so a warden's conversations come
    // back to the warden rather than vanishing into the no-reply sender.
    const { data: me } = await g.admin.auth.admin.getUserById(g.userId);
    const replyTo = me.user?.email ?? undefined;

    const subject = `Re: your NorthEDM request${request.service_type ? ` — ${request.service_type}` : ""}`;
    const greeting = request.name ? `Hi ${String(request.name).split(" ")[0]},` : "Hi,";
    const delivered = await sendEmail({
      to: request.email as string,
      toName: (request.name as string | null) ?? undefined,
      subject,
      replyTo,
      text: `${greeting}\n\n${message}\n\n— NorthEDM`,
      html: `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p><p>— NorthEDM</p>`,
    });

    // Record it either way — a failed send is exactly what the owner needs to
    // see, rather than assuming the person was answered.
    await checkWrite(
      `reply logged for request ${body.id}`,
      await g.admin.from("request_replies").insert({
        request_id: body.id,
        body: message,
        sent_by: g.userId,
        sent_to: request.email,
        delivered,
      })
    );

    if (!delivered) {
      return NextResponse.json(
        { error: "The email didn't send. It's saved below as not delivered — try again, or email them directly." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
