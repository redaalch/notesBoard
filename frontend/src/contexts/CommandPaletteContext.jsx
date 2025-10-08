import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import CommandPalette from "../Components/CommandPalette.jsx";

const CommandPaletteContext = createContext({
  openPalette: () => {},
  closePalette: () => {},
  registerCommands: () => () => {},
  setIsOpen: () => {},
  isOpen: false,
  commands: [],
});

export const CommandPaletteProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const registryRef = useRef(new Map());
  const [commands, setCommands] = useState([]);
  const navigate = useNavigate();

  const registerCommands = useCallback((commands) => {
    if (!Array.isArray(commands) || !commands.length) {
      return () => {};
    }

    const ids = [];
    commands.forEach((command) => {
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
        section: "Account",
        shortcut: "P",
        action: () => navigate("/profile"),
      },
    ]);
  }, [navigate, registerCommands]);

  const contextValue = useMemo(
    () => ({
      openPalette,
      closePalette,
      registerCommands,
      isOpen,
      commands,
      setIsOpen,
    }),
    [openPalette, closePalette, registerCommands, isOpen, commands]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCommandPalette = () => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider"
    );
  }
  return context;
};
