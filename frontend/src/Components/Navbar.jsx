import {
  ArrowRightIcon,
  FilterIcon,
  MenuIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";

const THEME_OPTIONS = [
  {
    name: "forest",
    label: "Forest",
    description: "Leafy greens and natural contrast",
    preview: ["bg-emerald-400", "bg-emerald-600", "bg-lime-400"],
  },
  {
    name: "dark",
    label: "Midnight",
    description: "Balanced, high-contrast night mode",
    preview: ["bg-slate-200", "bg-slate-500", "bg-slate-800"],
  },
  {
    name: "coffee",
    label: "Coffee",
    description: "Toasty espresso and crema tones",
    preview: ["bg-amber-400", "bg-amber-600", "bg-stone-700"],
  },
  {
    name: "retro",
    label: "Retro",
    description: "Vintage hues with playful saturation",
    preview: ["bg-amber-400", "bg-teal-500", "bg-rose-400"],
  },
  {
    name: "light",
    label: "Daylight",
    description: "Bright neutral workspace with clarity",
    preview: ["bg-sky-200", "bg-amber-200", "bg-emerald-200"],
  },
  {
    name: "cupcake",
    label: "Cupcake",
    description: "Frosted pastels and soft contrasts",
    preview: ["bg-pink-200", "bg-purple-300", "bg-emerald-200"],
  },
  {
    name: "valentine",
    label: "Valentine",
    description: "Warm rose tones with romantic glow",
    preview: ["bg-rose-400", "bg-pink-500", "bg-amber-300"],
  },
  {
    name: "cyberpunk",
    label: "Cyberpunk",
    description: "Electric neons with futuristic contrast",
    preview: ["bg-purple-600", "bg-fuchsia-500", "bg-sky-500"],
  },
  {
    name: "luxury",
    label: "Luxury",
    description: "Opulent gold accents on deep charcoal",
    preview: ["bg-stone-700", "bg-amber-400", "bg-amber-600"],
  },
  {
    name: "business",
    label: "Business",
    description: "Polished neutrals with professional blues",
    preview: ["bg-slate-200", "bg-slate-500", "bg-sky-500"],
  },
];

const THEME_MAP = new Map(THEME_OPTIONS.map((option) => [option.name, option]));
const SUPPORTED_THEMES = new Set(THEME_MAP.keys());
const DEFAULT_THEME = THEME_OPTIONS[0]?.name ?? "forest";
const DARK_THEME_FALLBACK = SUPPORTED_THEMES.has("dark")
  ? "dark"
  : DEFAULT_THEME;

let themeTransitionTimeoutId;

const setDocumentTheme = (themeName) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (typeof window !== "undefined") {
    root.classList.add("theme-changing");
    window.clearTimeout(themeTransitionTimeoutId);
    themeTransitionTimeoutId = window.setTimeout(() => {
      root.classList.remove("theme-changing");
    }, 120);
  }
  root.setAttribute("data-theme", themeName);
  root.dataset.theme = themeName;

  if (document.body) {
    document.body.setAttribute("data-theme", themeName);
    document.body.dataset.theme = themeName;
  }

  const rootContainer = document.getElementById("root");
  if (rootContainer) {
    rootContainer.setAttribute("data-theme", themeName);
    rootContainer.dataset.theme = themeName;
  }
};

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const getPreferredTheme = () => {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const stored = localStorage.getItem("theme");
    if (stored && SUPPORTED_THEMES.has(stored)) {
      return stored;
    }
  } catch {
    // Ignored: accessing localStorage can fail in some environments
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return DARK_THEME_FALLBACK;
  }

  return DEFAULT_THEME;
};

function Navbar({ onMobileFilterClick = () => {} }) {
  const [theme, setTheme] = useState(getPreferredTheme);
  const currentTheme = useMemo(
    () =>
      THEME_MAP.get(theme) ?? THEME_MAP.get(DEFAULT_THEME) ?? THEME_OPTIONS[0],
    [theme]
  );
  const currentThemeIndex = useMemo(() => {
    const index = THEME_OPTIONS.findIndex((option) => option.name === theme);
    return index === -1 ? 0 : index;
  }, [theme]);
  const nextTheme = useMemo(
    () => THEME_OPTIONS[(currentThemeIndex + 1) % THEME_OPTIONS.length],
    [currentThemeIndex]
  );
  const cycleThemeLabel = `Switch to ${nextTheme.label} theme`;
  const applyTheme = useCallback((themeName) => {
    if (!SUPPORTED_THEMES.has(themeName)) return;
    setDocumentTheme(themeName);
    setTheme(themeName);
  }, []);
  const cycleTheme = useCallback(() => {
    applyTheme(nextTheme.name);
  }, [applyTheme, nextTheme]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useIsomorphicLayoutEffect(() => {
    setDocumentTheme(theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // Persisting theme is best-effort only
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      applyTheme(event.matches ? DARK_THEME_FALLBACK : DEFAULT_THEME);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-b from-base-300/80 via-base-300/40 to-base-100/0 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 lg:px-8">
        <div className="flex items-center justify-between rounded-2xl border border-base-content/10 bg-base-200/60 px-4 py-3 shadow-lg shadow-primary/10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="dropdown lg:hidden">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-circle btn-ghost"
                aria-label="Open quick menu"
              >
                <MenuIcon className="size-5" />
              </button>
              <div
                tabIndex={0}
                className="dropdown-content z-40 mt-3 w-72 space-y-3 rounded-3xl border border-base-content/10 bg-gradient-to-br from-base-200/95 via-base-200/80 to-base-100/90 p-4 shadow-2xl shadow-primary/20 backdrop-blur"
              >
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/20 via-secondary/10 to-accent/10 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/90">
                    Quick actions
                  </p>
                  <p className="mt-1 text-sm text-base-content/70">
                    Stay in flow with shortcuts made for you.
                  </p>
                </div>

                <Link
                  to="/create"
                  className="group flex items-center gap-3 rounded-2xl border border-primary/30 bg-base-100/80 p-3 shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-primary/40"
                  aria-label="Create a new note"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary via-secondary to-accent text-primary-content">
                    <PlusIcon className="size-4" />
                  </span>
                  <div className="flex flex-1 flex-col text-left">
                    <span className="font-semibold text-base-content">
                      New note
                    </span>
                    <span className="text-xs text-base-content/60">
                      Capture something fresh in seconds.
                    </span>
                  </div>
                  <ArrowRightIcon className="size-4 text-primary transition group-hover:translate-x-0.5" />
                </Link>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.35em] text-base-content/60">
                      Themes
                    </p>
                    <span className="text-xs font-medium text-primary">
                      {currentTheme?.label ?? "Select theme"}
                    </span>
                  </div>
                  <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {THEME_OPTIONS.map((option) => {
                      const active = option.name === theme;
                      return (
                        <button
                          key={option.name}
                          type="button"
                          onClick={(event) => {
                            applyTheme(option.name);
                            if (event?.currentTarget) {
                              event.currentTarget.blur();
                            }
                          }}
                          className={`group relative flex h-full flex-col justify-between gap-2 rounded-2xl border p-3 text-left shadow-sm transition ${
                            active
                              ? "border-primary bg-primary/10 shadow-primary/30"
                              : "border-base-content/10 bg-base-100/80 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-primary/20"
                          }`}
                          aria-label={`Switch to ${option.label} theme`}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex gap-1 rounded-full bg-base-300/40 p-1">
                              {option.preview.map((tone) => (
                                <span
                                  key={`${option.name}-${tone}`}
                                  className={`h-3.5 w-3.5 rounded-full ${tone}`}
                                />
                              ))}
                            </span>
                            <span className="text-sm font-semibold text-base-content">
                              {option.label}
                            </span>
                          </span>
                          <span className="text-xs text-base-content/60 leading-relaxed">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <Link
              to={user ? "/app" : "/"}
              className="group flex items-center gap-3"
              aria-label="Go to dashboard"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-primary-content shadow-lg shadow-primary/30 transition-transform duration-200 group-hover:scale-105">
                <SparklesIcon className="size-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-xs uppercase tracking-[0.45em] text-base-content/60">
                  Notes
                </span>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Board
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <button
              type="button"
              className="btn btn-circle btn-outline lg:hidden"
              onClick={onMobileFilterClick}
              aria-label="Open filters"
            >
              <FilterIcon className="size-5" />
            </button>

            <Link
              to="/create"
              className="btn hidden items-center gap-2 rounded-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-content shadow-lg shadow-primary/30 transition hover:shadow-primary/50 lg:inline-flex"
            >
              <PlusIcon className="size-5" />
              <span>Create note</span>
            </Link>

            <div className="dropdown dropdown-end hidden lg:block">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-ghost rounded-full px-4"
                aria-haspopup="true"
                aria-expanded="false"
                aria-label={`Current theme: ${
                  currentTheme?.label ?? "unknown"
                }. Open theme selector.`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex gap-1">
                    {(currentTheme?.preview ?? []).map((tone) => (
                      <span
                        key={`active-${tone}`}
                        className={`h-3 w-3 rounded-full ${tone}`}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-semibold text-base-content">
                    {currentTheme?.label ?? "Theme"}
                  </span>
                  <SparklesIcon className="size-4 text-primary" />
                </span>
              </button>
              <div
                tabIndex={0}
                className="dropdown-content z-40 mt-3 w-[26rem] space-y-3 rounded-3xl border border-base-content/10 bg-base-200/95 p-5 shadow-2xl shadow-primary/30 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Theme studio
                  </p>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                    {currentTheme?.label ?? "Theme"}
                  </span>
                </div>
                <p className="text-sm text-base-content/60">
                  {currentTheme?.description ??
                    "Pick a mood to restyle your workspace."}
                </p>
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
                  {THEME_OPTIONS.map((option) => {
                    const active = option.name === theme;
                    return (
                      <button
                        key={`desktop-${option.name}`}
                        type="button"
                        onClick={() => applyTheme(option.name)}
                        className={`group relative flex h-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/15 shadow-primary/40"
                            : "border-base-content/10 bg-base-100/80 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-primary/20"
                        }`}
                        aria-label={`Activate ${option.label} theme`}
                      >
                        <span className="flex gap-1 rounded-full bg-base-300/40 p-1">
                          {option.preview.map((tone) => (
                            <span
                              key={`desktop-${option.name}-${tone}`}
                              className={`h-3.5 w-3.5 rounded-full ${tone}`}
                            />
                          ))}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-base-content">
                            {option.label}
                          </span>
                          <span className="text-xs text-base-content/60">
                            {option.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline gap-2"
                  onClick={cycleTheme}
                  aria-label={cycleThemeLabel}
                >
                  <SparklesIcon className="size-4" />
                  Surprise me
                  <span className="text-xs text-base-content/70">
                    ({nextTheme.label})
                  </span>
                </button>
              </div>
            </div>

            {user ? (
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="btn btn-ghost gap-3 rounded-full px-3"
                  aria-label="User menu"
                >
                  <div className="avatar placeholder">
                    <div className="w-10 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-content">
                      <span>{user.name?.charAt(0)?.toUpperCase() ?? "U"}</span>
                    </div>
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold leading-none">
                      {user.name}
                    </p>
                    <p className="text-xs text-base-content/60">{user.email}</p>
                  </div>
                </button>
                <ul
                  tabIndex={0}
                  className="menu dropdown-content z-40 mt-3 w-60 rounded-2xl border border-base-content/10 bg-base-200/95 p-4 shadow-xl backdrop-blur"
                >
                  <li className="mb-2 text-xs uppercase tracking-[0.3em] text-base-content/60">
                    Account
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="gap-2"
                    >
                      Sign out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn rounded-full border-primary/40 bg-base-100/80 backdrop-blur transition hover:border-primary hover:bg-base-100"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
