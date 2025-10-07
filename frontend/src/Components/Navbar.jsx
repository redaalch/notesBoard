import {
  FilterIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";

const LIGHT_THEME = "forest";
const DARK_THEME = "dark";
const SUPPORTED_THEMES = new Set([LIGHT_THEME, DARK_THEME]);

const getPreferredTheme = () => {
  if (typeof window === "undefined") return LIGHT_THEME;

  const stored = localStorage.getItem("theme");
  if (stored && SUPPORTED_THEMES.has(stored)) {
    return stored;
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return DARK_THEME;
  }

  return LIGHT_THEME;
};

function Navbar({ onMobileFilterClick = () => {} }) {
  const [theme, setTheme] = React.useState(getPreferredTheme);
  const isDark = theme === DARK_THEME;
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      setTheme(event.matches ? DARK_THEME : LIGHT_THEME);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleThemeToggle = () => {
    setTheme((current) => (current === DARK_THEME ? LIGHT_THEME : DARK_THEME));
  };

  const renderThemeIcon = () => {
    if (isDark) {
      return <MoonIcon className="size-5" />;
    }
    return <SunIcon className="size-5" />;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const themeToggleLabel = isDark
    ? "Switch to light theme"
    : "Switch to dark theme";

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-b from-base-300/80 via-base-300/40 to-base-100/0 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 lg:px-6">
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
              <ul
                tabIndex={0}
                className="menu dropdown-content z-40 mt-3 w-56 rounded-2xl border border-base-content/10 bg-base-200/90 p-3 shadow-xl backdrop-blur"
              >
                <li>
                  <Link
                    to="/create"
                    className="gap-2"
                    aria-label="Create a new note"
                  >
                    <PlusIcon className="size-4" />
                    <span>New note</span>
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleThemeToggle}
                    className="gap-2"
                    aria-label={themeToggleLabel}
                  >
                    {renderThemeIcon()}
                    <span>Toggle theme</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onMobileFilterClick}
                    className="gap-2"
                    aria-label="Open filters"
                  >
                    <FilterIcon className="size-4" />
                    <span>Open filters</span>
                  </button>
                </li>
              </ul>
            </div>

            <Link
              to="/"
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

            <button
              type="button"
              className="btn btn-circle btn-ghost hidden lg:flex"
              onClick={handleThemeToggle}
              aria-label={themeToggleLabel}
            >
              {renderThemeIcon()}
            </button>

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
