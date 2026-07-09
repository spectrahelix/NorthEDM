"use client";
import { useState } from "react";
import Link from "next/link";
import { RankBadge } from "./RankBadge";
import { AvatarBorder } from "./AvatarBorder";
import { profileTags, type UserProfile } from "@/utils/supabase/user-profiles";

export function UserPopover({
  profile,
  children,
}: {
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  const initials = profile.display_name.slice(0, 2).toUpperCase() || "??";

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}

      {show && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-sm"
          style={{ minWidth: 240 }}
        >
          <div className="mb-3 flex items-center gap-3">
            <AvatarBorder border={profile.avatar_border} size={40}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3AFFD4]/10 font-dm-mono text-sm text-[#3AFFD4]">
                  {initials}
                </div>
              )}
            </AvatarBorder>
            <div className="min-w-0 flex-1">
              <RankBadge role={profile.role} name={profile.display_name} tags={profileTags(profile)} />
              {profile.home_city && (
                <p className="mt-0.5 font-dm-mono text-[10px] text-neutral-500">
                  {profile.home_city}
                </p>
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="mb-3 line-clamp-2 text-xs text-neutral-400">
              {profile.bio}
            </p>
          )}
          <div className="flex gap-2">
            <Link
              href={`/profile/${profile.id}`}
              className="flex-1 rounded-lg bg-white/5 py-1.5 text-center text-xs text-neutral-300 transition hover:bg-white/10"
            >
              View Profile
            </Link>
            <Link
              href={`/messages?to=${profile.id}`}
              className="flex-1 rounded-lg bg-[#3AFFD4]/10 py-1.5 text-center text-xs text-[#3AFFD4] transition hover:bg-[#3AFFD4]/20"
            >
              Message
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
