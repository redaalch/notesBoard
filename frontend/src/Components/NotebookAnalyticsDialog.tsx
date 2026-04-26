import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIcon,
  BarChart3Icon,
  LineChartIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  NOTEBOOK_ANALYTICS_DEFAULT_RANGE,
  NOTEBOOK_ANALYTICS_RANGE_OPTIONS,
} from "@shared/analyticsTypes";
import { formatDate, formatRelativeTime } from "../lib/Utils";
import OverviewPanel from "./notebook-analytics/OverviewPanel";
import ActivityPanel from "./notebook-analytics/ActivityPanel";
import TagsPanel from "./notebook-analytics/TagsPanel";
import CollaboratorsPanel from "./notebook-analytics/CollaboratorsPanel";
import SnapshotsPanel from "./notebook-analytics/SnapshotsPanel";
import {
  fetchNotebookAnalytics,
  type NotebookAnalyticsResponse,
} from "./notebook-analytics/useNotebookAnalyticsQuery";

export interface NotebookAnalyticsDialogProps {
  notebook: { id?: string; _id?: string; name?: string } | null;
  open: boolean;
  onClose: () => void;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: ActivityIcon },
  { id: "activity", label: "Activity", icon: LineChartIcon },
  { id: "tags", label: "Tags", icon: TagIcon },
  { id: "collaborators", label: "Collaborators", icon: UsersIcon },
  { id: "snapshots", label: "Snapshots", icon: BarChart3Icon },
];

function NotebookAnalyticsDialog({
  notebook,
  open,
  onClose,
}: NotebookAnalyticsDialogProps) {
  const notebookId = notebook?.id ?? notebook?._id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [range, setRange] = useState(NOTEBOOK_ANALYTICS_DEFAULT_RANGE);
  const [overviewData, setOverviewData] = useState<
    NotebookAnalyticsResponse | undefined
  >(undefined);

  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
      setRange(NOTEBOOK_ANALYTICS_DEFAULT_RANGE);
      setOverviewData(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("overview");
    setOverviewData(undefined);
  }, [notebookId, open]);

  useEffect(() => {
    if (!open || !notebookId || activeTab !== "overview" || !overviewData) {
      return;
    }
    const slices = ["activity", "tags", "collaborators", "snapshots"];
    slices.forEach((slice) => {
      queryClient.prefetchQuery({
        queryKey: ["notebook-analytics", slice, notebookId, range],
        queryFn: () => fetchNotebookAnalytics({ notebookId, range, slice }),
        staleTime: 60_000,
      });
    });
  }, [open, notebookId, queryClient, overviewData, range, activeTab]);

  const cacheMeta = overviewData?.meta?.cache ?? null;
  const generatedAt = overviewData?.meta?.generatedAt ?? null;

  const headerSubline = useMemo(() => {
    if (!generatedAt) return null;
    const generatedDate = new Date(generatedAt);
    return `Generated ${formatRelativeTime(generatedDate)} (${formatDate(
      generatedDate,
    )})`;
  }, [generatedAt]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  if (!open || !notebookId) {
    return null;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "activity":
        return <ActivityPanel notebookId={notebookId} range={range} />;
      case "tags":
        return <TagsPanel notebookId={notebookId} range={range} />;
      case "collaborators":
        return <CollaboratorsPanel notebookId={notebookId} range={range} />;
      case "snapshots":
        return <SnapshotsPanel notebookId={notebookId} range={range} />;
      case "overview":
      default:
        return (
          <OverviewPanel
            notebookId={notebookId}
            range={range}
            onDataChange={setOverviewData}
          />
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[97] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[36px] border border-base-300/60 bg-base-100/95 px-6 py-6 shadow-2xl backdrop-blur"
        onClick={(event: React.MouseEvent<HTMLDivElement>) =>
          event.stopPropagation()
        }
      >
        <header className="flex flex-col gap-4 border-b border-base-300/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-base-content">
              Analytics for &quot;{notebookName}&quot;
            </h2>
            {headerSubline ? (
              <p className="text-sm text-base-content/60">{headerSubline}</p>
            ) : null}
            {cacheMeta ? (
              <p className="text-xs text-base-content/50">
                Cache {cacheMeta.hit ? "hit" : "miss"}; TTL{" "}
                {cacheMeta.ttlSeconds ? `${cacheMeta.ttlSeconds}s` : "n/a"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:w-48">
            <select
              className="select select-bordered select-sm"
              value={range}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setRange(event.target.value as typeof range)
              }
            >
              {NOTEBOOK_ANALYTICS_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
            >
              <XIcon className="size-4" />
              Close
            </button>
          </div>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`btn btn-sm rounded-xl px-4 ${
                  isActive ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                <IconComponent className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="mt-6 space-y-6" role="tabpanel">
          {renderActiveTab()}
        </section>
      </div>
    </div>
  );
}

export default NotebookAnalyticsDialog;
