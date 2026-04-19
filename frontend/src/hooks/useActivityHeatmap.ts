import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";

export interface ActivityHeatmapDay {
  date: string;
  editCount: number;
  eventCount: number;
}

export interface ActivityHeatmapResponse {
  days: ActivityHeatmapDay[];
  rangeStart: string;
  rangeEnd: string;
  wordsLastWeek: number;
  notesTouched: number;
  currentStreak: number;
  bestStreak: number;
}

export function useActivityHeatmap(days = 14) {
  return useQuery<ActivityHeatmapResponse>({
    queryKey: ["activity", "heatmap", days],
    queryFn: async () => {
      const res = await api.get("/activity/heatmap", { params: { days } });
      return res.data;
    },
    staleTime: 60_000,
  });
}
