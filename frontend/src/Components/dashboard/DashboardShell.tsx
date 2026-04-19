import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DsTheme = "dark" | "light";
export type DsAccent = "violet" | "amber" | "green" | "blue" | "pink";
export type DsDensity = "compact" | "normal" | "relaxed";
export type DsSidebar = "wide" | "narrow";

export interface DsTweaks {
  theme: DsTheme;
  accent: DsAccent;
  density: DsDensity;
  sidebar: DsSidebar;
}

const DEFAULT_TWEAKS: DsTweaks = {
  theme: "dark",
  accent: "violet",
  density: "normal",
  sidebar: "wide",
};

const STORAGE_KEY = "dashboardTweaks";

interface ShellContextValue {
  tweaks: DsTweaks;
  setTweak: <K extends keyof DsTweaks>(key: K, value: DsTweaks[K]) => void;
  tweaksOpen: boolean;
  setTweaksOpen: (open: boolean) => void;
  toggleTweaks: () => void;
  toggleSidebar: () => void;
}

const DashboardShellContext = createContext<ShellContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useDashboardShell = (): ShellContextValue => {
  const ctx = useContext(DashboardShellContext);
  if (!ctx) {
    throw new Error("useDashboardShell must be used within DashboardShell");
  }
  return ctx;
};

const loadTweaks = (): DsTweaks => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    const parsed = JSON.parse(raw) as Partial<DsTweaks>;
    return { ...DEFAULT_TWEAKS, ...parsed };
  } catch {
    return DEFAULT_TWEAKS;
  }
};

const setGlobalTheme = (theme: DsTheme) => {
  const daisy = theme === "dark" ? "notesDark" : "notesLight";
  for (const el of [
    document.documentElement,
    document.body,
    document.getElementById("root"),
  ]) {
    if (!el) continue;
    el.setAttribute("data-theme", daisy);
  }
  try {
    localStorage.setItem("theme", daisy);
  } catch {
    // ignore storage quota errors
  }
};

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [tweaks, setTweaks] = useState<DsTweaks>(() => loadTweaks());
  const [tweaksOpen, setTweaksOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore
    }
  }, [tweaks]);

  useEffect(() => {
    setGlobalTheme(tweaks.theme);
  }, [tweaks.theme]);

  const setTweak = useCallback(
    <K extends keyof DsTweaks>(key: K, value: DsTweaks[K]) => {
      setTweaks((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleTweaks = useCallback(() => setTweaksOpen((v) => !v), []);
  const toggleSidebar = useCallback(() => {
    setTweaks((prev) => ({
      ...prev,
      sidebar: prev.sidebar === "wide" ? "narrow" : "wide",
    }));
  }, []);

  const value = useMemo<ShellContextValue>(
    () => ({
      tweaks,
      setTweak,
      tweaksOpen,
      setTweaksOpen,
      toggleTweaks,
      toggleSidebar,
    }),
    [tweaks, setTweak, tweaksOpen, toggleTweaks, toggleSidebar],
  );

  return (
    <DashboardShellContext.Provider value={value}>
      <div
        data-dashboard-shell=""
        data-theme={tweaks.theme}
        data-accent={tweaks.accent}
        data-density={tweaks.density}
        data-sidebar={tweaks.sidebar}
      >
        <div className="ds-app">{children}</div>
      </div>
    </DashboardShellContext.Provider>
  );
}
