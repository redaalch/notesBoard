export const NOTEBOOK_ANALYTICS_DEFAULT_RANGE = "30d";

export const NOTEBOOK_ANALYTICS_RANGE_METADATA = Object.freeze({
  "7d": { days: 7, label: "Last 7 days" },
  "30d": { days: 30, label: "Last 30 days" },
  "90d": { days: 90, label: "Last 90 days" },
  "365d": { days: 365, label: "Last 365 days" },
});

export const NOTEBOOK_ANALYTICS_RANGES = Object.freeze(
  Object.keys(NOTEBOOK_ANALYTICS_RANGE_METADATA)
);

export const NOTEBOOK_ANALYTICS_RANGE_OPTIONS = NOTEBOOK_ANALYTICS_RANGES.map(
  (value) => ({
    value,
    label: NOTEBOOK_ANALYTICS_RANGE_METADATA[value].label,
  })
);

/**
 * @typedef {"7d" | "30d" | "90d" | "365d"} NotebookAnalyticsRange
 */

/**
 * @typedef {Object} NotebookAnalyticsRangeMeta
 * @property {NotebookAnalyticsRange} key
 * @property {number} days
 * @property {string} start
 * @property {string} end
 */

/**
 * @typedef {Object} NotebookAnalyticsSnapshotMeta
 * @property {number} total
 * @property {number} missingDays
 * @property {number} expectedDays
 * @property {number} coverageRatio
 * @property {boolean} liveFallbackApplied
 */

/**
 * @typedef {Object} NotebookAnalyticsNotesSeries
 * @property {number} total
 * @property {{ date: string, count: number }[]} daily
 * @property {{ week: string, count: number }[]} weekly
 */

/**
 * @typedef {Object} NotebookAnalyticsCollaboratorBreakdown
 * @property {Record<string, number>} notebookRoles
 * @property {Record<string, number>} noteCollaborators
 */

/**
 * @typedef {Object} NotebookAnalyticsOverviewMetrics
 * @property {NotebookAnalyticsNotesSeries} notesCreated
 * @property {{ tag: string, count: number }[]} topTags
 * @property {NotebookAnalyticsCollaboratorBreakdown} collaborators
 * @property {string | null} lastActivity
 */

/**
 * @typedef {Object} NotebookAnalyticsMeta
 * @property {string} generatedAt
 * @property {{ hit: boolean, ttlSeconds: number }} cache
 * @property {NotebookAnalyticsSnapshotMeta} snapshots
 */

/**
 * @typedef {Object} NotebookAnalyticsOverview
 * @property {string} notebookId
 * @property {NotebookAnalyticsRangeMeta} range
 * @property {NotebookAnalyticsOverviewMetrics} metrics
 * @property {NotebookAnalyticsMeta} meta
 */

/**
 * @typedef {{ label: string, data: number[] }} NotebookAnalyticsSeries
 */

/**
 * @typedef {Object} NotebookAnalyticsChartResponse
 * @property {string[]} labels
 * @property {NotebookAnalyticsSeries[]} series
 * @property {{ range: NotebookAnalyticsRangeMeta, totals?: Record<string, number>, snapshots?: NotebookAnalyticsSnapshotMeta, missingDates?: string[], details?: NotebookAnalyticsSnapshotDetail[] }} meta
 */

/**
 * @typedef {Object} NotebookAnalyticsSnapshotDetail
 * @property {string} date
 * @property {number} notesCreated
 * @property {number} editsCount
 * @property {number} uniqueEditors
 * @property {{ tag: string, count: number }[]} topTags
 * @property {Record<string, number>} collaboratorTotals
 * @property {string | null} generatedAt
 */

export default {
  NOTEBOOK_ANALYTICS_DEFAULT_RANGE,
  NOTEBOOK_ANALYTICS_RANGE_METADATA,
  NOTEBOOK_ANALYTICS_RANGES,
  NOTEBOOK_ANALYTICS_RANGE_OPTIONS,
};
