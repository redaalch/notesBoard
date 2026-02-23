import { type ReactNode } from "react";
import {
  BarChart3Icon,
  ClockIcon,
  FileTextIcon,
  PinIcon,
  TagIcon,
} from "lucide-react";
import {
  countWords,
  formatRelativeTime,
  formatTagLabel,
  normalizeTag,
} from "../lib/Utils";
import { MetricTile, Surface } from "./ui";

interface Note {
  content: string;
  pinned?: boolean;
  tags?: string[];
  updatedAt?: string;
  createdAt: string;
}

interface TagStats {
  tags?: { _id: string; count: number }[];
  uniqueTags?: number;
  topTag?: { _id: string; count: number };
}

const average = (numbers: number[]): number => {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

const numberFormatter = new Intl.NumberFormat();

const LoadingTile = () => (
  <Surface variant="raised" padding="sm" className="animate-pulse space-y-3">
    <div className="h-3.5 w-20 rounded-full bg-border-subtle/40" />
    <div className="h-7 w-28 rounded-xl bg-border-subtle/50" />
    <div className="h-3 w-24 rounded-full bg-border-subtle/30" />
  </Surface>
);

interface NotesStatsProps {
  notes: Note[];
  loading?: boolean;
  tagStats?: TagStats;
}

function NotesStats({ notes, loading, tagStats }: NotesStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingTile key={`loading-metric-${index}`} />
        ))}
      </div>
    );
  }

  if (!notes.length) {
    return null;
  }

  const wordCounts = notes.map((note) => countWords(note.content));
  const pinnedCount = notes.filter((note) => note.pinned).length;
  let uniqueTags = 0;
  let topTag: string | undefined;
  let topTagCount: number | undefined;

  if (tagStats?.tags?.length) {
    uniqueTags = tagStats.uniqueTags ?? tagStats.tags.length;
    topTag = tagStats.topTag?._id;
    topTagCount = tagStats.topTag?.count;
  } else {
    const tagFrequency = new Map<string, number>();
    notes.forEach((note) => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => {
          const normalized = normalizeTag(tag);
          if (!normalized) return;
          tagFrequency.set(normalized, (tagFrequency.get(normalized) ?? 0) + 1);
        });
      }
    });
    const sortedTags = Array.from(tagFrequency.entries()).sort(
      (a, b) => b[1] - a[1],
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
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const dailyMomentum = notes.filter((note) => {
    const createdAt = new Date(note.createdAt);
    const now = new Date();
    const diff = now.getTime() - createdAt.getTime();
    return diff <= 86_400_000;
  }).length;

  const formattedNotes = numberFormatter.format(notes.length);
  const formattedPinned = numberFormatter.format(pinnedCount);
  const formattedAvg = `${numberFormatter.format(avgWords)} words`;
  const formattedLongest = numberFormatter.format(longest);
  const formattedMomentum = numberFormatter.format(dailyMomentum);
  const formattedTags = `${numberFormatter.format(uniqueTags)} tags`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricTile
        label="Total notes"
        value={formattedNotes}
        sublabel={`Last update ${formatRelativeTime(latestUpdate)}`}
        icon={<BarChart3Icon className="size-5" aria-hidden="true" />}
      />
      <MetricTile
        label="Pinned notes"
        value={formattedPinned}
        sublabel={
          pinnedCount
            ? "Pinned for quick access"
            : "Pin important notes to prioritize them"
        }
        icon={<PinIcon className="size-5" aria-hidden="true" />}
      />
      <MetricTile
        label="Average length"
        value={formattedAvg}
        sublabel={`Longest note is ${formattedLongest} words`}
        icon={<FileTextIcon className="size-5" aria-hidden="true" />}
      />
      <MetricTile
        label="Daily momentum"
        value={formattedMomentum}
        sublabel="Notes captured in the last 24 hours"
        icon={<ClockIcon className="size-5" aria-hidden="true" />}
      />
      <MetricTile
        label="Tag coverage"
        value={formattedTags}
        sublabel={
          topTag
            ? `${formatTagLabel(topTag)} appears in ${numberFormatter.format(
                topTagCount ?? 0,
              )} note${(topTagCount ?? 0) === 1 ? "" : "s"}`
            : "Add tags to unlock insights"
        }
        icon={<TagIcon className="size-5" aria-hidden="true" />}
      />
    </div>
  );
}

export default NotesStats;
