import {
  BarChart3Icon,
  ClockIcon,
  FileTextIcon,
  PinIcon,
  TagIcon,
} from "lucide-react";
import { countWords, formatRelativeTime } from "../lib/Utils.js";

const average = (numbers) => {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

const prettifyTag = (tag) =>
  tag
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function NotesStats({ notes, loading, tagStats }) {
  if (loading) {
    return (
      <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full">
        <div className="stat">
          <div className="skeleton mb-2 h-6 w-24" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="stat">
          <div className="skeleton mb-2 h-6 w-24" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="stat">
          <div className="skeleton mb-2 h-6 w-24" />
          <div className="skeleton h-8 w-32" />
        </div>
      </div>
    );
  }

  if (!notes.length) {
    return null;
  }

  const wordCounts = notes.map((note) => countWords(note.content));
  const pinnedCount = notes.filter((note) => note.pinned).length;
  let uniqueTags = 0;
  let topTag;
  let topTagCount;

  if (tagStats?.tags?.length) {
    uniqueTags = tagStats.uniqueTags ?? tagStats.tags.length;
    topTag = tagStats.topTag?._id;
    topTagCount = tagStats.topTag?.count;
  } else {
    const tagFrequency = new Map();
    notes.forEach((note) => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => {
          const normalized = tag.trim().toLowerCase().replace(/\s+/g, " ");
          if (!normalized) return;
          tagFrequency.set(normalized, (tagFrequency.get(normalized) ?? 0) + 1);
        });
      }
    });
    const sortedTags = Array.from(tagFrequency.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const [fallbackTopTag, fallbackTopCount] = sortedTags[0] ?? [];
    uniqueTags = tagFrequency.size;
    topTag = fallbackTopTag;
    topTagCount = fallbackTopCount;
  }

  const avgWords = Math.round(average(wordCounts));
  const longest = wordCounts.length ? Math.max(...wordCounts) : 0;
  const latestUpdate = notes
    .map((note) => note.updatedAt ?? note.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return (
    <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full">
      <div className="stat">
        <div className="stat-figure text-primary">
          <BarChart3Icon className="size-7 sm:size-8" />
        </div>
        <div className="stat-title">Total notes</div>
        <div className="stat-value text-primary">{notes.length}</div>
        <div className="stat-desc text-base-content/70">
          Last update {formatRelativeTime(latestUpdate)}
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-warning">
          <PinIcon className="size-7 sm:size-8" />
        </div>
        <div className="stat-title">Pinned notes</div>
        <div className="stat-value text-warning">{pinnedCount}</div>
        <div className="stat-desc text-base-content/70">
          {pinnedCount
            ? "Kept at the top for easy access"
            : "Pin important notes to prioritize them"}
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-secondary">
          <FileTextIcon className="size-7 sm:size-8" />
        </div>
        <div className="stat-title">Average length</div>
        <div className="stat-value text-secondary">{avgWords} words</div>
        <div className="stat-desc text-base-content/70">
          Longest note is {longest} words
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-accent">
          <ClockIcon className="size-7 sm:size-8" />
        </div>
        <div className="stat-title">Daily momentum</div>
        <div className="stat-value text-accent">
          {
            notes.filter((note) => {
              const createdAt = new Date(note.createdAt);
              const now = new Date();
              const diff = now - createdAt;
              return diff <= 86_400_000;
            }).length
          }
        </div>
        <div className="stat-desc text-base-content/70">
          Notes captured in the last 24 hours
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-info">
          <TagIcon className="size-7 sm:size-8" />
        </div>
        <div className="stat-title">Tag coverage</div>
        <div className="stat-value text-info">
          {uniqueTags}
          <span className="ml-1 text-sm font-semibold">tags</span>
        </div>
        <div className="stat-desc text-base-content/70">
          {topTag
            ? `${prettifyTag(topTag)} appears in ${topTagCount} note${
                topTagCount === 1 ? "" : "s"
              }`
            : "Add tags to unlock insights"}
        </div>
      </div>
    </div>
  );
}

export default NotesStats;
