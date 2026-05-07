import { formatDistanceToNow } from "date-fns";

interface PresenceMember {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: Date;
  fullName: string;
  avatarUrl: string | null;
  timezone: string;
}

interface PresenceCardProps {
  member: PresenceMember;
  isCurrentUser?: boolean;
}

const STATUS_DOT_CLASS = {
  online: "status-dot-online",
  away: "status-dot-away",
  offline: "status-dot-offline",
};

export function PresenceCard({ member, isCurrentUser }: PresenceCardProps) {
  const initials = member.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const lastSeen =
    member.status !== "online"
      ? formatDistanceToNow(member.lastSeenAt, { addSuffix: true })
      : null;

  return (
    <div className="card-base flex items-center gap-3 p-4">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt={member.fullName}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-xs font-medium text-secondary-foreground">
              {initials}
            </span>
          </div>
        )}
        {/* Status dot */}
        <span
          className={`status-dot absolute -bottom-0.5 -right-0.5 ring-2 ring-card ${STATUS_DOT_CLASS[member.status]}`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">
            {member.fullName}
          </p>
          {isCurrentUser && (
            <span className="text-2xs text-muted-foreground">(you)</span>
          )}
        </div>
        <p className="text-2xs text-muted-foreground">
          {lastSeen ? `Last seen ${lastSeen}` : member.timezone}
        </p>
      </div>

      {/* Status label */}
      <span className="text-2xs font-medium text-muted-foreground capitalize">
        {member.status}
      </span>
    </div>
  );
}
