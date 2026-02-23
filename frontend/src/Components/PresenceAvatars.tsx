export interface Participant {
  id?: string;
  name?: string;
  color?: string;
}

interface ParticipantAvatarProps {
  participant: Participant;
}

const ParticipantAvatar = ({ participant }: ParticipantAvatarProps) => {
  if (!participant) return null;
  const initials = participant.name
    ? participant.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "?";

  return (
    <div
      className="avatar placeholder -ml-2 first:ml-0"
      title={`${participant.name ?? "Unknown"}`}
    >
      <div
        className="w-8 rounded-full border-2 border-base-100 text-xs font-semibold text-base-100"
        style={{ backgroundColor: participant.color ?? "#2563EB" }}
      >
        {initials}
      </div>
    </div>
  );
};

export interface PresenceAvatarsProps {
  participants?: Participant[];
}

const PresenceAvatars = ({ participants = [] }: PresenceAvatarsProps) => {
  if (!participants.length) {
    return (
      <div className="text-xs text-base-content/60">
        You're the only one here.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {participants.slice(0, 5).map((participant) => (
          <ParticipantAvatar
            key={participant.id ?? participant.name}
            participant={participant}
          />
        ))}
      </div>
      {participants.length > 5 && (
        <span className="badge badge-sm badge-outline">
          +{participants.length - 5}
        </span>
      )}
    </div>
  );
};

export default PresenceAvatars;
