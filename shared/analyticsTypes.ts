// ── Range types ──────────────────────────────────────────────

export type NotebookAnalyticsRange = "7d" | "30d" | "90d" | "365d";

export interface NotebookAnalyticsRangeEntry {
  days: number;
  label: string;
}

export interface NotebookAnalyticsRangeMeta {
  key: NotebookAnalyticsRange;
  days: number;
  start: string;
  end: string;
}

// ── Constants ────────────────────────────────────────────────

export const NOTEBOOK_ANALYTICS_DEFAULT_RANGE: NotebookAnalyticsRange = "30d";

export const NOTEBOOK_ANALYTICS_RANGE_METADATA: Readonly<
  Record<NotebookAnalyticsRange, NotebookAnalyticsRangeEntry>
> = Object.freeze({
  "7d": { days: 7, label: "Last 7 days" },
  "30d": { days: 30, label: "Last 30 days" },
  "90d": { days: 90, label: "Last 90 days" },
  "365d": { days: 365, label: "Last 365 days" },
});

export const NOTEBOOK_ANALYTICS_RANGES: readonly NotebookAnalyticsRange[] =
  Object.freeze(
    Object.keys(NOTEBOOK_ANALYTICS_RANGE_METADATA) as NotebookAnalyticsRange[],
  );

export const NOTEBOOK_ANALYTICS_RANGE_OPTIONS = NOTEBOOK_ANALYTICS_RANGES.map(
  (value) => ({
    value,
    label: NOTEBOOK_ANALYTICS_RANGE_METADATA[value].label,
  }),
);

// ── Snapshot & Metrics types ─────────────────────────────────

export interface NotebookAnalyticsSnapshotMeta {
  total: number;
  missingDays: number;
  expectedDays: number;
  coverageRatio: number;
  liveFallbackApplied: boolean;
}

export interface NotebookAnalyticsNotesSeries {
  total: number;
  daily: { date: string; count: number }[];
  weekly: { week: string; count: number }[];
}

export interface NotebookAnalyticsCollaboratorBreakdown {
  notebookRoles: Record<string, number>;
  noteCollaborators: Record<string, number>;
}

export interface NotebookAnalyticsOverviewMetrics {
  notesCreated: NotebookAnalyticsNotesSeries;
  topTags: { tag: string; count: number }[];
  collaborators: NotebookAnalyticsCollaboratorBreakdown;
  lastActivity: string | null;
}

export interface NotebookAnalyticsMeta {
  generatedAt: string;
  cache: { hit: boolean; ttlSeconds: number };
  snapshots: NotebookAnalyticsSnapshotMeta;
}

export interface NotebookAnalyticsOverview {
  notebookId: string;
  range: NotebookAnalyticsRangeMeta;
  metrics: NotebookAnalyticsOverviewMetrics;
  meta: NotebookAnalyticsMeta;
}

export interface NotebookAnalyticsSeries {
  label: string;
  data: number[];
}

export interface NotebookAnalyticsSnapshotDetail {
  date: string;
  notesCreated: number;
  editsCount: number;
  uniqueEditors: number;
  topTags: { tag: string; count: number }[];
  collaboratorTotals: Record<string, number>;
  generatedAt: string | null;
}

export interface NotebookAnalyticsChartResponse {
  labels: string[];
  series: NotebookAnalyticsSeries[];
  meta: {
    range: NotebookAnalyticsRangeMeta;
    totals?: Record<string, number>;
    snapshots?: NotebookAnalyticsSnapshotMeta;
    missingDates?: string[];
    details?: NotebookAnalyticsSnapshotDetail[];
  };
}

export default {
  NOTEBOOK_ANALYTICS_DEFAULT_RANGE,
  NOTEBOOK_ANALYTICS_RANGE_METADATA,
  NOTEBOOK_ANALYTICS_RANGES,
  NOTEBOOK_ANALYTICS_RANGE_OPTIONS,
};
