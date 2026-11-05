import { NORTHEDM_SOCIALS } from "@/utils/socials";

/**
 * "Join us Online for quick responses and updates!" with NorthEDM's Facebook
 * and Instagram buttons (owner, 2026-11-05). Links live in utils/socials.ts;
 * nothing is drawn until at least one is set. Server- and client-safe.
 */
export function JoinUsOnline({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { facebook, instagram } = NORTHEDM_SOCIALS;
  if (!facebook && !instagram) return null;
  const btn = "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:brightness-125";
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${compact ? "px-3 py-3" : "px-4 py-4"} text-center ${className}`}>
      <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-white`}>Join us Online for quick responses and updates!</p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-2">
        {facebook && (
          <a href={facebook} target="_blank" rel="noopener noreferrer" className={btn}
            style={{ borderColor: "#1877F255", background: "#1877F21f", color: "#8FB8FF" }}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg>
            Facebook
          </a>
        )}
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className={btn}
            style={{ borderColor: "#E1306C55", background: "linear-gradient(135deg,#F5871F22,#E1306C22,#833AB422)", color: "#FF9CC2" }}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            Instagram
          </a>
        )}
      </div>
    </div>
  );
}
