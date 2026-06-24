import { FeedbackForm } from "./FeedbackForm";

export const metadata = {
  title: "Feedback",
  description: "Tell the NorthEDM team what you think — bugs, ideas, and praise from our beta testers.",
};

export default function FeedbackPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">Beta Testing</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Send Feedback</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          You&apos;re helping launch NorthEDM — thank you. Found a bug, have an idea, or just want to
          tell us what you think? Drop it below and it goes straight to the team.
        </p>

        <FeedbackForm />
      </div>
    </main>
  );
}
