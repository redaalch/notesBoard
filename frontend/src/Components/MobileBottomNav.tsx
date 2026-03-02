import {
  HomeIcon,
  SearchIcon,
  PlusIcon,
  FolderOpenIcon,
  UserIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export interface MobileBottomNavProps {
  /** Callback when "Search" tab is tapped (opens search overlay / focuses input) */
  onSearchClick?: () => void;
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
  onSearchClick,
  onNotebooksClick,
  defaultNotebookId,
}: MobileBottomNavProps) {
  const { pathname } = useLocation();

  const navItems: NavItemDef[] = [
    { icon: HomeIcon, label: "Home", path: "/app" },
    { icon: SearchIcon, label: "Search", action: onSearchClick },
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
        const isActive = item.path ? pathname === item.path : false;

        /* ── Raised center "Create" button ── */
        if (item.special) {
          return (
            <Link
              key="create"
              to="/create"
              state={
                defaultNotebookId
                  ? { notebookId: defaultNotebookId }
                  : undefined
              }
              className="relative -mt-5 flex flex-col items-center"
              aria-label="Create note"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="grid size-14 place-items-center rounded-full bg-primary text-primary-content shadow-lg shadow-primary/30"
              >
                <PlusIcon className="size-6" strokeWidth={2.5} />
              </motion.div>
              <span className="mt-0.5 text-[10px] font-medium text-primary">
                {item.label}
              </span>
            </Link>
          );
        }

        /* ── Regular tab items ── */
        const Wrapper = item.path ? Link : "button";
        const wrapperProps: Record<string, unknown> = item.path
          ? { to: item.path }
          : { type: "button", onClick: item.action };

        return (
          <Wrapper
            key={item.label}
            {...(wrapperProps as any)}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors ${
              isActive
                ? "text-primary"
                : "text-base-content/50 active:text-base-content/80"
            }`}
            aria-label={item.label}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>

            {isActive && (
              <motion.div
                layoutId="mobileNavActive"
                className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </Wrapper>
        );
      })}
    </nav>
  );
}

export default MobileBottomNav;
