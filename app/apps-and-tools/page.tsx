import Link from "next/link";
import type { Metadata } from "next";
import { APP_TOOLS } from "./tools";

export const metadata: Metadata = {
  title: "Apps and Tools | NorthEDM",
  description: "Free tools from NorthEDM: birth charts, Hebrew birthdays, gematria and more.",
};

export default function AppsAndToolsPage() {
  return (
    <main className="min-h-screen px-4 py-12 text-neutral-100 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.3em] text-violet-300">NorthEDM</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Apps and Tools</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-neutral-300">
          Free tools made by NorthEDM. Unite the Northeast.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {APP_TOOLS.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-violet-300/40 hover:bg-violet-300/[0.05]"
            >
              <p className="font-dm-mono text-xs uppercase tracking-widest text-violet-300">{t.category}</p>
              <h2 className="mt-2 text-2xl font-semibold group-hover:text-white">{t.title}</h2>
              <p className="mt-3 leading-7 text-neutral-300">{t.description}</p>
              <span className="mt-4 inline-block text-sm text-violet-200">Open →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
