import { AvatarBorder } from "@/app/components/AvatarBorder";
import { RankBadge } from "@/app/components/RankBadge";
import { TagChips } from "@/app/components/TagChips";
import type { TagKey } from "@/app/components/roleColors";

/**
 * The one profile header: avatar on the left, name + rank beside it, meta line
 * under the name, tags in their own wrapping row, actions in their own row.
 * Used by /profile/[id] and /profile/edit so the two never drift again.
 */
export function ProfileHeader({
  avatarUrl, avatarBorder, displayName, role, tags, username, meta, actions, accent, size = 96,
}: {
  avatarUrl: string | null;
  avatarBorder: string;
  displayName: string;
  role: string;
  tags: TagKey[];
  username?: string | null;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: string;
  size?: number;
}) {
  const initials = displayName.slice(0, 2).toUpperCase() || "??";
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="shrink-0">
          <AvatarBorder border={avatarBorder} size={size}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="rounded-full object-cover" style={{ width: size, height: size }} />
            ) : (
              <div className="flex items-center justify-center rounded-full bg-neutral-800 font-bebas text-3xl tracking-wide"
                style={{ width: size, height: size, color: accent ?? "#3AFFD4" }}>
                {initials}
              </div>
            )}
          </AvatarBorder>
        </div>
        <div className="min-w-0 flex-1">
          <RankBadge role={role} name={displayName} size="lg" />
          {username && <p className="mt-0.5 font-dm-mono text-xs text-neutral-500">@{username}</p>}
          {meta && <div className="mt-1.5 text-sm text-neutral-400">{meta}</div>}
        </div>
      </div>
      {tags.length > 0 && <div className="mt-4"><TagChips tags={tags} size="lg" /></div>}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
