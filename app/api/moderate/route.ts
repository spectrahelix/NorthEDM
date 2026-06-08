import { NextRequest, NextResponse } from "next/server";

// Slurs and hate speech — the list stays small and targeted so we avoid
// blocking legitimate festival/foraging language (mushrooms, drug harm-reduction, etc.)
const HARD_BLOCK = [
  /\bn[i!1]gg[ae3r]/i,
  /\bf[a@4]gg[o0]t/i,
  /\bch[i1]nk\b/i,
  /\bsp[i1]c\b/i,
  /\bk[i1]ke\b/i,
  /\btr[a4]nn[yi]/i,
  /\bretard(ed)?\b/i,
  /\bc[u*]nt\b/i,
  /\bwh[o0]re\b/i,
  /\bk[i1]ll\s+your?se?l[fv]/i,
  /\bdo[x*]{1,2}(ing|ed)?\b/i,
];

// Spam patterns
function isSpam(text: string): string | null {
  if (text.trim().length < 3) return "Post is too short.";
  if (text.length > 12000) return "Post exceeds maximum length.";

  // Excessive URLs
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  if (urlCount > 4) return "Too many links — looks like spam.";

  // Extreme ALL CAPS (>80% uppercase letters, more than 30 chars)
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 30) {
    const upperRatio = (text.replace(/[^A-Z]/g, "").length) / letters.length;
    if (upperRatio > 0.8) return "Please don't write in all caps.";
  }

  // Excessive repeated characters (e.g. "AAAAAAAAA")
  if (/(.)\1{9,}/.test(text)) return "Post contains excessive repeated characters.";

  return null;
}

export async function POST(req: NextRequest) {
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false, reason: "Invalid request." }, { status: 400 });
  }

  const content = String(body.content ?? "").trim();

  if (!content) {
    return NextResponse.json({ allowed: false, reason: "Content cannot be empty." });
  }

  for (const pattern of HARD_BLOCK) {
    if (pattern.test(content)) {
      return NextResponse.json({
        allowed: false,
        reason:
          "Your post contains language that violates our community guidelines. Keep it respectful.",
      });
    }
  }

  const spamReason = isSpam(content);
  if (spamReason) {
    return NextResponse.json({ allowed: false, reason: spamReason });
  }

  return NextResponse.json({ allowed: true });
}
