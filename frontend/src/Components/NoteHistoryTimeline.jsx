import { useState } from "react";
import {
  ClockIcon,
  FileEditIcon,
  PinIcon,
  TagIcon,
  MoveIcon,
  PlusIcon,
  TrashIcon,
  TypeIcon,
  MessageSquareIcon,
} from "lucide-react";

const eventIcons = {
  edit: FileEditIcon,
  pin: PinIcon,
  unpin: PinIcon,
  tag: TagIcon,
  move: MoveIcon,
  create: PlusIcon,
  delete: TrashIcon,
  title: TypeIcon,
  comment: MessageSquareIcon,
};

const eventColors = {
  edit: "text-blue-600",
  pin: "text-yellow-600",
  unpin: "text-gray-600",
  tag: "text-purple-600",
  move: "text-green-600",
  create: "text-emerald-600",
  delete: "text-red-600",
  title: "text-indigo-600",
  comment: "text-orange-600",
};

const formatRelativeTime = (date) => {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
};

const HistoryItem = ({ event, actor, showDiff }) => {
  const Icon = eventIcons[event.eventType] || FileEditIcon;
  const colorClass = eventColors[event.eventType] || "text-base-content";

  return (
    <div className="group relative flex gap-3 pb-4 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-8 h-full w-px bg-base-300 group-last:hidden" />

      {/* Icon */}
      <div
        className={`relative z-10 flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-base-200 ${colorClass}`}
      >
        <Icon className="size-4" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-base-content">
            {actor?.name || "Unknown User"}
          </span>
          <span className="text-sm text-base-content/60">
            {event.eventType}
          </span>
          <span className="text-xs text-base-content/50">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        {event.summary && (
          <p className="text-sm text-base-content/80">{event.summary}</p>
        )}

        {showDiff && event.diff && (
          <div className="mt-2 rounded-lg border border-base-300 bg-base-200/50 p-3">
            <pre className="text-xs">{JSON.stringify(event.diff, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

const NoteHistoryTimeline = ({ history = [], actors = {}, noteTitle }) => {
  const [showDiffs, setShowDiffs] = useState(false);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClockIcon className="mb-3 size-12 text-base-content/30" />
        <p className="text-base-content/60">No activity yet</p>
        <p className="text-sm text-base-content/50">
          Changes to this note will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base-300 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-base-content">
            Activity History
          </h3>
          {noteTitle && (
            <p className="text-sm text-base-content/60">{noteTitle}</p>
          )}
        </div>
        <label className="label cursor-pointer gap-2">
          <span className="label-text text-xs">Show diffs</span>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showDiffs}
            onChange={(e) => setShowDiffs(e.target.checked)}
          />
        </label>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {history.map((event) => (
          <HistoryItem
            key={event._id}
            event={event}
            actor={actors[event.actorId]}
            showDiff={showDiffs}
          />
        ))}
      </div>
    </div>
  );
};

export default NoteHistoryTimeline;
