import { useMemo } from "react";
import { useActivityHeatmap } from "../../hooks/useActivityHeatmap";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const pad2 = (n: number) => n.toString().padStart(2, "0");
const toDateKey = (d: Date) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

interface Cell {
  key: string;
  date: Date;
  editCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  today: boolean;
}

function computeLevels(counts: number[]): (0 | 1 | 2 | 3 | 4)[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (!nonZero.length) return counts.map(() => 0);
  const q = (p: number) =>
    nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))];
  const l1 = q(0.25);
  const l2 = q(0.5);
  const l3 = q(0.75);
  return counts.map((c) => {
    if (c <= 0) return 0;
    if (c <= l1) return 1;
    if (c <= l2) return 2;
    if (c <= l3) return 3;
    return 4;
  });
}

export default function ActivityHeatmap({ days = 14 }: { days?: number }) {
  const { data, isLoading } = useActivityHeatmap(days);

  const cells = useMemo<Cell[]>(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = toDateKey(today);

    const map = new Map<string, number>();
    for (const d of data?.days ?? []) {
      map.set(d.date, d.editCount);
    }

    const out: Cell[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = toDateKey(d);
      out.push({
        key,
        date: d,
        editCount: map.get(key) ?? 0,
        level: 0,
        today: key === todayKey,
      });
    }
    const levels = computeLevels(out.map((c) => c.editCount));
    return out.map((c, i) => ({ ...c, level: levels[i] }));
  }, [data, days]);

  const wordsLastWeek = data?.wordsLastWeek ?? 0;
  const notesTouched = data?.notesTouched ?? 0;
  const currentStreak = data?.currentStreak ?? 0;
  const bestStreak = data?.bestStreak ?? 0;

  return (
    <div className="ds-panel">
      <div className="ds-p-head">
        <span className="ds-p-title">Writing activity</span>
        <span className="ds-p-meta">
          {days % 7 === 0 ? `${days / 7}w` : `${days}d`}
        </span>
      </div>

      <div className="ds-hm-stats">
        <div className="ds-hm-s">
          <span className="ds-v">{wordsLastWeek.toLocaleString()}</span>
          <span className="ds-l">words · 7d</span>
        </div>
        <div className="ds-hm-s">
          <span className="ds-v">{notesTouched}</span>
          <span className="ds-l">notes touched</span>
        </div>
        <div className="ds-hm-s">
          <span className="ds-v">
            {currentStreak}
            <span className="ds-delta neutral" style={{ marginLeft: 4 }}>
              /{bestStreak}
            </span>
          </span>
          <span className="ds-l">streak · best</span>
        </div>
      </div>

      <div
        className="ds-heatmap"
        style={{
          gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, 1fr)`,
          opacity: isLoading ? 0.5 : 1,
        }}
      >
        {cells.map((c) => {
          const label = c.date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return (
            <div
              key={c.key}
              className={`ds-cell l${c.level}${c.today ? " today" : ""}`}
              title={`${label} · ${c.editCount} edit${c.editCount !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>

      <div className="ds-hm-legend">
        <span>{WEEKDAYS.join(" ")}</span>
        <div className="ds-scale">
          <span className="ds-l" style={{ marginRight: 4 }}>
            less
          </span>
          <span className="ds-cell" />
          <span className="ds-cell l1" />
          <span className="ds-cell l2" />
          <span className="ds-cell l3" />
          <span className="ds-cell l4" />
          <span className="ds-l" style={{ marginLeft: 4 }}>
            more
          </span>
        </div>
      </div>
    </div>
  );
}
