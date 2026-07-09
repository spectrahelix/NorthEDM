// Generic transactional email via Brevo's API (serverless IPs are blocked by
// Brevo's SMTP allowlist, so we use the HTTP API with a key). Best-effort:
// returns false on missing config or failure rather than throwing.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  toName?: string;
}): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.error("sendEmail: BREVO_API_KEY not set");
    return false;
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@northedm.com";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "NorthEDM", email: senderEmail },
        to: [{ email: opts.to, ...(opts.toName ? { name: opts.toName } : {}) }],
        subject: opts.subject,
        ...(opts.html ? { htmlContent: opts.html } : {}),
        ...(opts.text ? { textContent: opts.text } : {}),
      }),
    });
    if (!res.ok) {
      console.error("sendEmail failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendEmail error:", e);
    return false;
  }
}
