import Link from "next/link";

type Status = "approved" | "pending" | "none";

// The three membership calls-to-action shown on a user's OWN profile.
// Each reflects the viewer's current status for that program.
export function ProfileCTAs({
  vendor,
  festdash,
  promoter,
}: {
  vendor: Status;
  festdash: Status;
  promoter: Status;
}) {
  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      {/* Vendor */}
      <Cta
        color="#39FF14"
        status={vendor}
        applyHref="/vendors/apply"
        apply="Are you a Vendor? Apply here to receive your Vendor opportunities with NorthEDM!"
        pending="Your vendor application is under review — hang tight!"
        approved="You are a vendor! NorthEDM thanks you for joining the community!"
      />

      {/* FestDash — gated on being a vendor first */}
      {festdash === "approved" ? (
        <Cta color="#FB923C" status="approved"
          approved="You're a FestDash Vendor — start delivering! The shop never stops. 🚚" />
      ) : vendor === "approved" ? (
        <Cta
          color="#FB923C"
          status={festdash}
          applyHref="/festdash/vendor-signup"
          apply="Welcome Vendor! Click here to become a FestDash Vendor and start delivering!"
          pending="Your FestDash application is under review — almost there!"
          approved=""
        />
      ) : (
        <Cta color="#FB923C" status="locked"
          applyHref="/vendors/apply"
          apply="Want FestDash? Become a NorthEDM Vendor first — apply here to unlock it →" />
      )}

      {/* Promoter */}
      <Cta
        color="#E8FF47"
        status={promoter}
        applyHref="/festdash/promoter-signup"
        apply="Want to support the NorthEDM Community? Become a Promoter for additional opportunities!"
        pending="Your promoter application is under review — thank you!"
        approved="NorthEDM greatly thanks you for supporting!"
      />
    </div>
  );
}

function Cta({
  color,
  status,
  applyHref,
  apply,
  pending,
  approved,
}: {
  color: string;
  status: Status | "locked";
  applyHref?: string;
  apply?: string;
  pending?: string;
  approved?: string;
}) {
  const base =
    "flex h-full min-h-[92px] items-center justify-center rounded-2xl border p-4 text-center text-sm leading-snug transition";

  if (status === "approved") {
    return (
      <div
        className={base}
        style={{ borderColor: `${color}55`, background: `${color}12`, color }}
      >
        <span className="font-semibold">{approved}</span>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div
        className={`${base} text-neutral-400`}
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        <span>⏳ {pending}</span>
      </div>
    );
  }
  // "none" or "locked" → clickable
  return (
    <Link
      href={applyHref || "#"}
      className={`${base} hover:opacity-90 active:scale-[0.99]`}
      style={{ borderColor: `${color}55`, background: `${color}0e`, color }}
    >
      <span className="font-semibold">{apply}</span>
    </Link>
  );
}
