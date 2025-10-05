import {
  FilterIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

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

  return (
    <header className="bg-base-300 border-b border-base-content/10">
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="dropdown lg:hidden">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-ghost btn-square"
                aria-label="Open menu"
              >
                <MenuIcon className="size-5" />
              </button>
              <ul
                tabIndex={0}
                className="menu dropdown-content z-30 mt-3 w-48 rounded-box bg-base-200 p-2 shadow"
              >
                <li>
                  <Link to="/create" className="gap-2">
                    <PlusIcon className="size-4" />
                    <span>New note</span>
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleThemeToggle}
                    className="gap-2"
                  >
                    {renderThemeIcon()}
                    <span>Toggle theme</span>
                  </button>
                </li>
              </ul>
            </div>
            <h1 className="text-3xl font-bold text-primary font-mono tracking-tight">
              NotesBoard
            </h1>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button
              type="button"
              className="btn btn-outline btn-square lg:hidden"
              onClick={onMobileFilterClick}
              aria-label="Open filters"
            >
              <FilterIcon className="size-5" />
            </button>

            <Link
              to="/create"
              className="btn btn-primary hidden lg:inline-flex"
            >
              <PlusIcon className="size-5" />
              <span>New Note</span>
            </Link>

            <button
              type="button"
              className="btn btn-ghost btn-square hidden lg:inline-flex"
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
            >
              {renderThemeIcon()}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
