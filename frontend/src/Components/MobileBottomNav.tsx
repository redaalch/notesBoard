import { useState } from "react";
import {
  HomeIcon,
  FileTextIcon,
  PlusIcon,
  FolderOpenIcon,
  UserIcon,
  PlusCircleIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";

export interface MobileBottomNavProps {
  /** Callback when "Notebooks" tab is tapped (opens sidebar drawer) */
  onNotebooksClick?: () => void;
  /** Optional: notebook ID to pass to create */
  defaultNotebookId?: string | null;
}

interface NavItemDef {
  icon: React.ElementType;
  label: string;
  path?: string;
  action?: () => void;
  special?: boolean;
}

export function MobileBottomNav({
  onNotebooksClick,
  defaultNotebookId,
}: MobileBottomNavProps) {
  const { pathname } = useLocation();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const createLinkState =
    defaultNotebookId ? { notebookId: defaultNotebookId } : undefined;

  const navItems: NavItemDef[] = [
    { icon: HomeIcon, label: "Home", path: "/home" },
    { icon: FileTextIcon, label: "Notes", path: "/app" },
    { icon: PlusIcon, label: "Create", path: "/create", special: true },
    { icon: FolderOpenIcon, label: "Notebooks", action: onNotebooksClick },
    { icon: UserIcon, label: "Profile", path: "/profile" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-around border-t border-base-300/50 bg-base-100/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.path
          ? pathname === item.path ||
            (item.path === "/app" && pathname.startsWith("/note"))
          : false;

        /* ── Raised center "Create" button ── */
        if (item.special) {
          return (
            <div key="create" className="relative -mt-3 flex flex-col items-center">
              <m.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setCreateMenuOpen((v) => !v)}
                className="grid size-11 place-items-center rounded-full bg-primary text-primary-content shadow-md shadow-primary/25"
                aria-label="Create note"
              >
                <PlusIcon className="size-5" strokeWidth={2.5} />
              </m.button>
              <span className="mt-0.5 text-[10px] font-medium text-primary">
                {item.label}
              </span>

              {/* Create action sheet */}
              <AnimatePresence>
                {createMenuOpen && (
                  <>
                    <m.div
                      key="create-backdrop"
                      className="fixed inset-0 z-40"
                      onClick={() => setCreateMenuOpen(false)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                    <m.div
                      key="create-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-3 z-50 w-48 rounded-xl border border-base-300/40 bg-base-100 p-1.5 shadow-xl"
                    >
                      <Link
                        to="/create"
                        state={createLinkState}
                        onClick={() => setCreateMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-base-200/60"
                      >
                        <PlusCircleIcon className="size-4 text-primary" />
                        Blank note
                      </Link>
                      <Link
                        to="/create"
                        state={{ ...createLinkState, openTemplates: true }}
                        onClick={() => setCreateMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-base-200/60"
                      >
                        <LayoutTemplateIcon className="size-4 text-primary" />
                        From template
                      </Link>
                    </m.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          );
        }

        /* ── Regular tab items ── */
        const className = `relative flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors ${
          isActive
            ? "text-primary"
            : "text-base-content/50 active:text-base-content/80"
        }`;
        const children = (
          <>
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <m.div
                layoutId="mobileNavActive"
                className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </>
        );

        return item.path ? (
          <Link
            key={item.label}
            to={item.path}
            className={className}
            aria-label={item.label}
          >
            {children}
          </Link>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={className}
            aria-label={item.label}
          >
            {children}
          </button>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
