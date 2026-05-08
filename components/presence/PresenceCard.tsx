import { formatDistanceToNow } from "date-fns";

interface PresenceMember {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: Date;
  name: string;
  avatarUrl: string | null;
  timezone: string;
}

interface PresenceCardProps {
  member: PresenceMember;
  isCurrentUser?: boolean;
}

const STATUS_DOT: Record<string, string> = {
  online: "status-dot-online",
  away: "status-dot-away",
  offline: "status-dot-offline",
};

function getAvatarUrl(userId: string, name: string, avatarUrl: string | null): string {
  if (avatarUrl && avatarUrl.startsWith("http")) return avatarUrl;
  // DiceBear — professional illustrated avatars
  const seed = encodeURIComponent(name || userId);
  return `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=c41230,1B3A6B,1C1C1C&scale=80`;
}

export function PresenceCard({ member, isCurrentUser }: PresenceCardProps) {
  const avatarSrc = getAvatarUrl(member.userId, member.name, member.avatarUrl);
  const lastSeen = member.status !== "online"
    ? formatDistanceToNow(member.lastSeenAt, { addSuffix: true })
    : null;

  const isDiceBear = !member.avatarUrl || !member.avatarUrl.startsWith("http");

  return (
    <div className="card-base flex items-center gap-3 p-3">
      <div className="relative flex-shrink-0">
        {isDiceBear ? (
          <div className="w-9 h-9 rounded overflow-hidden"
            style={{ background: "hsl(var(--charcoal))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc} alt={member.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt={member.name} className="w-9 h-9 rounded object-cover" />
        )}
        <span className={`status-dot absolute -bottom-0.5 -right-0.5 ring-2 ring-card ${STATUS_DOT[member.status]}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-foreground truncate">{member.name || "Unknown"}</p>
          {isCurrentUser && (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.55rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.08em" }}>(you)</span>
          )}
        </div>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))" }}>
          {lastSeen ? `Last seen ${lastSeen}` : member.timezone}
        </p>
      </div>

      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))" }}>
        {member.status}
      </span>
    </div>
  );
}
