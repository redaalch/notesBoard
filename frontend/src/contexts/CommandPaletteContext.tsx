import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import CommandPalette from "../Components/CommandPalette";

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

export const CommandPaletteProvider = ({
  children,
}: CommandPaletteProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const registryRef = useRef(new Map<string, PaletteCommand>());
  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const navigate = useNavigate();

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
      // Navigation Commands
      {
        id: "core:create-note",
        label: "Create note",
        description: "Start a fresh note",
        section: "Navigation",
        shortcut: "C",
        action: () => navigate("/create"),
      },
      {
        id: "core:go-home",
        label: "Go to dashboard",
        description: "Open your boards and notes",
        section: "Navigation",
        shortcut: "H",
        action: () => navigate("/app"),
      },
      {
        id: "core:open-profile",
        label: "Open profile settings",
        description: "Manage your account and preferences",
        section: "Navigation",
        shortcut: "P",
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
      {
        id: "core:refresh",
        label: "Refresh page",
        description: "Reload the current page",
        section: "Navigation",
        shortcut: "R",
        action: () => window.location.reload(),
      },

      // Account Commands
      {
        id: "core:logout",
        label: "Log out",
        description: "Sign out of your account",
        section: "Account",
        shortcut: "Q",
        action: () => {
          localStorage.removeItem("token");
          navigate("/login");
          window.location.reload();
        },
      },

      // Appearance Commands
      {
        id: "core:theme-forest",
        label: "Switch to Forest theme",
        description: "Dark green forest theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "forest");
          localStorage.setItem("theme", "forest");
        },
      },
      {
        id: "core:theme-dark",
        label: "Switch to Dark theme",
        description: "Classic dark theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "dark");
          localStorage.setItem("theme", "dark");
        },
      },
      {
        id: "core:theme-light",
        label: "Switch to Light theme",
        description: "Clean light theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "light");
          localStorage.setItem("theme", "light");
        },
      },
      {
        id: "core:theme-coffee",
        label: "Switch to Coffee theme",
        description: "Warm coffee brown theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "coffee");
          localStorage.setItem("theme", "coffee");
        },
      },
      {
        id: "core:theme-retro",
        label: "Switch to Retro theme",
        description: "Vintage retro theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "retro");
          localStorage.setItem("theme", "retro");
        },
      },
      {
        id: "core:theme-cupcake",
        label: "Switch to Cupcake theme",
        description: "Sweet cupcake pastel theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "cupcake");
          localStorage.setItem("theme", "cupcake");
        },
      },
      {
        id: "core:theme-valentine",
        label: "Switch to Valentine theme",
        description: "Romantic pink theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "valentine");
          localStorage.setItem("theme", "valentine");
        },
      },
      {
        id: "core:theme-cyberpunk",
        label: "Switch to Cyberpunk theme",
        description: "Neon cyberpunk theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "cyberpunk");
          localStorage.setItem("theme", "cyberpunk");
        },
      },
      {
        id: "core:theme-luxury",
        label: "Switch to Luxury theme",
        description: "Elegant luxury dark theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "luxury");
          localStorage.setItem("theme", "luxury");
        },
      },
      {
        id: "core:theme-business",
        label: "Switch to Business theme",
        description: "Professional business theme",
        section: "Appearance",
        action: () => {
          document.documentElement.setAttribute("data-theme", "business");
          localStorage.setItem("theme", "business");
        },
      },

      // Help & Documentation
      {
        id: "core:keyboard-shortcuts",
        label: "View keyboard shortcuts",
        description: "See all available shortcuts",
        section: "Help",
        shortcut: "?",
        action: () => {
          closePalette();
          setTimeout(() => {
            alert(
              "Keyboard Shortcuts:\n\n" +
                "⌘K or Ctrl+K - Open command palette\n" +
                "C - Create new note\n" +
                "H - Go to dashboard\n" +
                "P - Open profile\n" +
                "B - Go back\n" +
                "R - Refresh page\n" +
                "Q - Log out\n" +
                "/ - Focus search\n" +
                "? - Show this help",
            );
          }, 100);
        },
      },
      {
        id: "core:privacy-policy",
        label: "Privacy Policy",
        description: "View our privacy policy",
        section: "Help",
        action: () => navigate("/privacy"),
      },
      {
        id: "core:terms-of-service",
        label: "Terms of Service",
        description: "View our terms of service",
        section: "Help",
        action: () => navigate("/terms"),
      },

      // System Commands
      {
        id: "core:clear-cache",
        label: "Clear local cache",
        description: "Clear browser cache and reload",
        section: "System",
        action: () => {
          if (
            window.confirm(
              "This will clear your local cache and reload the page. Continue?",
            )
          ) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }
        },
      },
      {
        id: "core:copy-url",
        label: "Copy current URL",
        description: "Copy the current page URL to clipboard",
        section: "System",
        action: async () => {
          await navigator.clipboard.writeText(window.location.href);
          closePalette();
        },
      },
      {
        id: "core:toggle-fullscreen",
        label: "Toggle fullscreen",
        description: "Enter or exit fullscreen mode",
        section: "System",
        shortcut: "F",
        action: () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        },
      },
    ]);
  }, [navigate, registerCommands, closePalette]);

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
      <CommandPalette />
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
