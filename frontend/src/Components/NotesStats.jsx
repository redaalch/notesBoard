import { BarChart3Icon, ClockIcon, FileTextIcon } from "lucide-react";
import { countWords, formatRelativeTime } from "../lib/Utils.js";

const average = (numbers) => {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

function NotesStats({ notes, loading }) {
  if (loading) {
    return (
      <div className="stats shadow bg-base-100">
        <div className="stat">
          <div className="skeleton h-6 w-24 mb-2" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="stat">
          <div className="skeleton h-6 w-24 mb-2" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="stat">
          <div className="skeleton h-6 w-24 mb-2" />
          <div className="skeleton h-8 w-32" />
        </div>
      </div>
    );
  }

  if (!notes.length) {
    return null;
  }

  const wordCounts = notes.map((note) => countWords(note.content));
  const avgWords = Math.round(average(wordCounts));
  const longest = wordCounts.length ? Math.max(...wordCounts) : 0;
  const latestUpdate = notes
    .map((note) => note.updatedAt ?? note.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return (
    <div className="stats shadow bg-base-100 w-full">
      <div className="stat">
        <div className="stat-figure text-primary">
          <BarChart3Icon className="size-8" />
        </div>
        <div className="stat-title">Total notes</div>
        <div className="stat-value text-primary">{notes.length}</div>
        <div className="stat-desc text-base-content/70">
          Last update {formatRelativeTime(latestUpdate)}
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-secondary">
          <FileTextIcon className="size-8" />
        </div>
        <div className="stat-title">Average length</div>
        <div className="stat-value text-secondary">{avgWords} words</div>
        <div className="stat-desc text-base-content/70">
          Longest note is {longest} words
        </div>
      </div>

      <div className="stat">
        <div className="stat-figure text-accent">
          <ClockIcon className="size-8" />
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
    </div>
  );
}

export default NotesStats;
