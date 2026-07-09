"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMsg("No verification token provided.");
      return;
    }
    fetch("/api/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          setState("ok");
          setMsg(j.email ? `Your email is now ${j.email}.` : "Your email has been confirmed.");
        } else {
          setState("error");
          setMsg(j.error || "Something went wrong.");
        }
      })
      .catch(() => {
        setState("error");
        setMsg("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        {state === "loading" && (
          <>
            <div className="mb-3 text-4xl">⏳</div>
            <h1 className="font-bebas text-3xl tracking-wide">Confirming…</h1>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mb-3 text-4xl">✅</div>
            <h1 className="font-bebas text-3xl tracking-wide text-[#39FF14]">Email confirmed</h1>
            <p className="mt-2 text-sm text-neutral-400">{msg}</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Go to Log In
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mb-3 text-4xl">⚠️</div>
            <h1 className="font-bebas text-3xl tracking-wide text-[#FF5C3A]">Couldn&apos;t confirm</h1>
            <p className="mt-2 text-sm text-neutral-400">{msg}</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl border border-white/10 px-6 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5"
            >
              Back home
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
