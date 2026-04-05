export const NOTEBOOK_ANALYTICS_DEFAULT_RANGE = "30d";

export const NOTEBOOK_ANALYTICS_RANGE_METADATA = Object.freeze({
  "7d": { days: 7, label: "Last 7 days" },
  "30d": { days: 30, label: "Last 30 days" },
  "90d": { days: 90, label: "Last 90 days" },
  "365d": { days: 365, label: "Last 365 days" },
});

export const NOTEBOOK_ANALYTICS_RANGES = Object.freeze(
  Object.keys(NOTEBOOK_ANALYTICS_RANGE_METADATA),
);

export const NOTEBOOK_ANALYTICS_RANGE_OPTIONS = NOTEBOOK_ANALYTICS_RANGES.map(
  (value) => ({
    value,
    label: NOTEBOOK_ANALYTICS_RANGE_METADATA[value].label,
  }),
);

export default {
  NOTEBOOK_ANALYTICS_DEFAULT_RANGE,
  NOTEBOOK_ANALYTICS_RANGE_METADATA,
  NOTEBOOK_ANALYTICS_RANGES,
  NOTEBOOK_ANALYTICS_RANGE_OPTIONS,
};
