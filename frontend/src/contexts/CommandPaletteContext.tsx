import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useAuth from "../hooks/useAuth";

const CommandPalette = lazy(() => import("../Components/CommandPalette"));
const KeyboardShortcutsHelp = lazy(
  () => import("../Components/KeyboardShortcutsHelp"),
);

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  section?: string;
  shortcut?: string;
  keywords?: string[];
  action: () => void | Promise<void>;
}

export interface CommandPaletteContextValue {
  openPalette: () => void;
  closePalette: () => void;
  registerCommands: (commands: PaletteCommand[]) => () => void;
  setIsOpen: (open: boolean) => void;
  isOpen: boolean;
  commands: PaletteCommand[];
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  openPalette: () => {},
  closePalette: () => {},
  registerCommands: () => () => {},
  setIsOpen: () => {},
  isOpen: false,
  commands: [],
});

interface CommandPaletteProviderProps {
  children: ReactNode;
}

const setDocTheme = (theme: string) => {
  const targets = [
    document.documentElement,
    document.body,
    document.getElementById("root"),
  ].filter(Boolean) as HTMLElement[];
  for (const el of targets) {
    el.setAttribute("data-theme", theme);
    el.dataset.theme = theme;
  }
  localStorage.setItem("theme", theme);
};

export const CommandPaletteProvider = ({
  children,
}: CommandPaletteProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const registryRef = useRef(new Map<string, PaletteCommand>());
  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const registerCommands = useCallback((cmds: PaletteCommand[]) => {
    if (!Array.isArray(cmds) || !cmds.length) {
      return () => {};
    }

    const ids: string[] = [];
    cmds.forEach((command) => {
      if (!command?.id) return;
      ids.push(command.id);
      registryRef.current.set(command.id, command);
    });
    setCommands(Array.from(registryRef.current.values()));

    return () => {
      let changed = false;
      ids.forEach((id) => {
        if (registryRef.current.has(id)) {
          changed = true;
          registryRef.current.delete(id);
        }
      });
      if (changed) {
        setCommands(Array.from(registryRef.current.values()));
      }
    };
  }, []);

  const openPalette = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    return registerCommands([
      // ── Navigation ──────────────────────────────────────────────────
      {
        id: "core:create-note",
        label: "Create new note",
        description: "Start writing a fresh note",
        section: "Navigation",
        shortcut: "C",
        keywords: ["new", "add", "write", "compose"],
        action: () => navigate("/create"),
      },
      {
        id: "core:go-notes",
        label: "Go to notes",
        description: "Open your notes board",
        section: "Navigation",
        shortcut: "N",
        keywords: ["home", "board", "notes", "app"],
        action: () => navigate("/app"),
      },
      {
        id: "core:go-dashboard",
        label: "Go to dashboard",
        description: "View stats, recent activity and overview",
        section: "Navigation",
        shortcut: "D",
        keywords: ["dashboard", "overview", "stats", "analytics"],
        action: () => navigate("/home"),
      },
      {
        id: "core:open-profile",
        label: "Open profile settings",
        description: "Manage your account and preferences",
        section: "Navigation",
        shortcut: "P",
        keywords: ["account", "settings", "profile", "preferences"],
        action: () => navigate("/profile"),
      },
      {
        id: "core:go-back",
        label: "Go back",
        description: "Navigate to the previous page",
        section: "Navigation",
        shortcut: "B",
        action: () => window.history.back(),
      },
      {
        id: "core:go-forward",
        label: "Go forward",
        description: "Navigate to the next page",
        section: "Navigation",
        action: () => window.history.forward(),
      },

      // ── Appearance ──────────────────────────────────────────────────
      {
        id: "core:theme-light",
        label: "Switch to Daylight theme",
        description: "Bright neutrals with a calm accent",
        section: "Appearance",
        keywords: ["light", "bright", "day", "theme"],
        action: () => setDocTheme("notesLight"),
      },
      {
        id: "core:theme-dark",
        label: "Switch to Night Shift theme",
        description: "Dim surfaces with gentle contrast",
        section: "Appearance",
        keywords: ["dark", "night", "dim", "theme"],
        action: () => setDocTheme("notesDark"),
      },

      // ── System ──────────────────────────────────────────────────────
      {
        id: "core:copy-url",
        label: "Copy current URL",
        description: "Copy the page URL to clipboard",
        section: "System",
        keywords: ["copy", "link", "url", "share", "clipboard"],
        action: async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success("URL copied to clipboard.");
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            console.error("Failed to copy URL to clipboard:", message);
            toast.error(`Failed to copy URL: ${message}`);
          }
        },
      },
      {
        id: "core:toggle-fullscreen",
        label: "Toggle fullscreen",
        description: "Enter or exit fullscreen mode",
        section: "System",
        shortcut: "F",
        keywords: ["fullscreen", "maximize", "expand"],
        action: async () => {
          try {
            if (!document.fullscreenElement) {
              if (
                typeof document.documentElement.requestFullscreen !== "function"
              ) {
                throw new Error(
                  "Fullscreen API is not available in this browser.",
                );
              }
              await document.documentElement.requestFullscreen();
            } else {
              if (typeof document.exitFullscreen !== "function") {
                throw new Error(
                  "Fullscreen exit is not available in this browser.",
                );
              }
              await document.exitFullscreen();
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            console.error("Failed to toggle fullscreen:", message);
          }
        },
      },
      {
        id: "core:refresh",
        label: "Refresh page",
        description: "Reload the current page",
        section: "System",
        shortcut: "R",
        keywords: ["reload", "refresh"],
        action: () => window.location.reload(),
      },
      {
        id: "core:clear-cache",
        label: "Clear local cache",
        description: "Clear browser storage and reload",
        section: "System",
        keywords: ["cache", "clear", "reset", "storage"],
        action: () => {
          if (
            window.confirm(
              "This will clear your local cache and reload the page. Continue?",
            )
          ) {
            // Remove app-specific keys but preserve user preferences (theme).
            const theme = localStorage.getItem("theme");
            localStorage.clear();
            if (theme) localStorage.setItem("theme", theme);
            sessionStorage.clear();
            window.location.reload();
          }
        },
      },

      // ── Account ─────────────────────────────────────────────────────
      {
        id: "core:logout",
        label: "Log out",
        description: "Sign out of your account",
        section: "Account",
        shortcut: "Q",
        keywords: ["logout", "sign out", "exit"],
        action: async () => {
          await logout();
          navigate("/login", { replace: true });
        },
      },

      // ── Help ────────────────────────────────────────────────────────
      {
        id: "core:keyboard-shortcuts",
        label: "Keyboard shortcuts",
        description: "Show the keyboard shortcut cheatsheet",
        section: "Help",
        shortcut: "?",
        keywords: ["shortcut", "cheatsheet", "keyboard", "help", "keys"],
        action: () => {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "?", bubbles: true }),
          );
        },
      },
      {
        id: "core:privacy-policy",
        label: "Privacy Policy",
        description: "View our privacy policy",
        section: "Help",
        keywords: ["privacy", "policy", "legal"],
        action: () => navigate("/privacy"),
      },
      {
        id: "core:terms-of-service",
        label: "Terms of Service",
        description: "View our terms of service",
        section: "Help",
        keywords: ["terms", "service", "legal"],
        action: () => navigate("/terms"),
      },
    ]);
  }, [navigate, registerCommands, logout]);

  const contextValue: CommandPaletteContextValue = useMemo(
    () => ({
      openPalette,
      closePalette,
      registerCommands,
      isOpen,
      commands,
      setIsOpen,
    }),
    [openPalette, closePalette, registerCommands, isOpen, commands],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <Suspense fallback={null}>
        <CommandPalette />
        <KeyboardShortcutsHelp />
      </Suspense>
    </CommandPaletteContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCommandPalette = (): CommandPaletteContextValue => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }
  return context;
};
