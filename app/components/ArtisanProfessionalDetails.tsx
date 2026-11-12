import type { UserProfile } from "@/utils/supabase/user-profiles";

export function ArtisanProfessionalDetails({ profile, className }: {
  profile: Pick<UserProfile, "artisan_profession" | "artisan_specialty">;
  className?: string;
}) {
  const details = [
    { label: "Profession", value: profile.artisan_profession?.trim() },
    { label: "Specialty", value: profile.artisan_specialty?.trim() },
  ].filter(detail => detail.value);

  if (!details.length) return null;

  return (
    <dl className={className}>
      {details.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-400">{label}</dt>
          <dd className="mt-0.5 text-sm leading-snug text-neutral-200 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
